#!/usr/bin/env bash
# One-time setup: lets GitHub Actions deploy sites to YOUR PERSONAL Azure
# subscription using OpenID Connect (no passwords or long-lived secrets stored).
#
# It creates:
#   • resource group  (studio.config.json → azure.resourceGroup)
#   • an Entra app registration + service principal for GitHub Actions
#   • federated credentials for: pushes to main, pull requests, manual runs
#   • a Contributor role assignment scoped to ONLY that resource group
#   • GitHub repo secrets AZURE_CLIENT_ID / AZURE_TENANT_ID / AZURE_SUBSCRIPTION_ID (if gh is installed)
#
# Run from the repo root after `az login` (and `gh auth login` if you want secrets set for you):
#   bash studio/infra/bootstrap.sh
# Safe to re-run.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
cfg() { node -e "const c=require('./studio/studio.config.json');console.log($1)"; }

REPO=$(cfg 'c.github.repo')
RG=$(cfg 'c.azure.resourceGroup')
LOCATION=$(cfg 'c.azure.location')
APP_NAME=$(cfg 'c.azure.deployerAppName')
EXPECTED=$(cfg 'c.azure.expectedAccount || ""')

command -v az >/dev/null || { echo "✖ Azure CLI not found: https://aka.ms/installazurecli"; exit 1; }

echo "── Checking which Azure account is signed in ─────────────────────"
ACCOUNT_JSON=$(az account show -o json 2>/dev/null) || { echo "✖ Run 'az login' first."; exit 1; }
SUB_ID=$(echo "$ACCOUNT_JSON" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).id))')
SUB_NAME=$(echo "$ACCOUNT_JSON" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).name))')
TENANT_ID=$(echo "$ACCOUNT_JSON" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).tenantId))')
USER_NAME=$(echo "$ACCOUNT_JSON" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).user.name))')

echo "  User:         $USER_NAME"
echo "  Subscription: $SUB_NAME ($SUB_ID)"
echo "  Tenant:       $TENANT_ID"
echo "  GitHub repo:  $REPO"
echo "  Resource grp: $RG ($LOCATION)"

lower() { tr '[:upper:]' '[:lower:]' <<<"$1"; }
if [[ -n "$EXPECTED" && "$(lower "$USER_NAME")" != "$(lower "$EXPECTED")" ]]; then
  echo "✖ Signed in as '$USER_NAME' but studio.config.json expects '$EXPECTED'."
  echo "  This guard keeps personal sites out of work tenants. Run 'az login' with the right account,"
  echo "  then 'az account set --subscription <personal-subscription>'."
  exit 1
fi

read -r -p "Type the subscription name exactly to confirm this is your PERSONAL subscription: " CONFIRM
[[ "$CONFIRM" == "$SUB_NAME" ]] || { echo "✖ Didn't match — nothing was changed."; exit 1; }

echo "── Resource provider & group ─────────────────────────────────────"
az provider register --namespace Microsoft.Web --wait -o none
az group create -n "$RG" -l "$LOCATION" --tags managedBy=site-studio -o none
RG_ID=$(az group show -n "$RG" --query id -o tsv)
echo "  ✔ $RG"

echo "── App registration for GitHub Actions ───────────────────────────"
APP_ID=$(az ad app list --display-name "$APP_NAME" --query "[0].appId" -o tsv)
if [[ -z "$APP_ID" ]]; then
  APP_ID=$(az ad app create --display-name "$APP_NAME" --query appId -o tsv)
  echo "  ✔ created $APP_NAME ($APP_ID)"
else
  echo "  ✔ exists  $APP_NAME ($APP_ID)"
fi
SP_ID=$(az ad sp show --id "$APP_ID" --query id -o tsv 2>/dev/null || az ad sp create --id "$APP_ID" --query id -o tsv)

EXISTING=$(az ad app federated-credential list --id "$APP_ID" --query "[].name" -o tsv)
add_cred() {
  local name=$1 subject=$2
  if grep -qx "$name" <<<"$EXISTING"; then echo "  ✔ federated credential $name"; return; fi
  az ad app federated-credential create --id "$APP_ID" -o none --parameters "{
    \"name\": \"$name\",
    \"issuer\": \"https://token.actions.githubusercontent.com\",
    \"subject\": \"$subject\",
    \"audiences\": [\"api://AzureADTokenExchange\"]
  }"
  echo "  ✔ federated credential $name → $subject"
}
add_cred gh-main "repo:${REPO}:ref:refs/heads/main"
add_cred gh-pull-request "repo:${REPO}:pull_request"

echo "── Role assignment (Contributor on $RG only) ─────────────────────"
if [[ -z $(az role assignment list --assignee "$SP_ID" --scope "$RG_ID" --role Contributor --query "[0].id" -o tsv) ]]; then
  # New service principals can take a few seconds to replicate.
  for i in 1 2 3 4 5; do
    az role assignment create --assignee-object-id "$SP_ID" --assignee-principal-type ServicePrincipal \
      --role Contributor --scope "$RG_ID" -o none && break
    echo "  …waiting for the service principal to replicate ($i)"; sleep $((i * 5))
  done
fi
echo "  ✔ Contributor on $RG"

echo "── GitHub secrets ────────────────────────────────────────────────"
if command -v gh >/dev/null && gh auth status >/dev/null 2>&1; then
  gh secret set AZURE_CLIENT_ID       -R "$REPO" -b "$APP_ID"
  gh secret set AZURE_TENANT_ID       -R "$REPO" -b "$TENANT_ID"
  gh secret set AZURE_SUBSCRIPTION_ID -R "$REPO" -b "$SUB_ID"
  echo "  ✔ secrets set on $REPO"
  if gh api "repos/$REPO/pages" >/dev/null 2>&1; then
    echo "  ✔ GitHub Pages already enabled"
  elif gh api -X POST "repos/$REPO/pages" -f build_type=workflow >/dev/null 2>&1; then
    echo "  ✔ GitHub Pages enabled (source: GitHub Actions)"
  else
    echo "  ⚠ Couldn't enable Pages automatically — Settings → Pages → Source: GitHub Actions"
  fi
else
  echo "  gh CLI not signed in. Add these in GitHub → $REPO → Settings → Secrets and variables → Actions:"
  echo "    AZURE_CLIENT_ID       = $APP_ID"
  echo "    AZURE_TENANT_ID       = $TENANT_ID"
  echo "    AZURE_SUBSCRIPTION_ID = $SUB_ID"
  echo "  and enable Pages: Settings → Pages → Source: GitHub Actions"
fi

echo
echo "Done. Merge a site with \"targets\": [\"azure\"] to main and the 'Studio sites' workflow will deploy it."
