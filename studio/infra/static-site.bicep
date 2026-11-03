// One Azure Static Web App per site. Deployed by .github/workflows/studio-sites.yml
// into the studio resource group; safe to re-run (idempotent).
@description('Static Web App resource name, e.g. swa-gulf-breeze-bakery')
param name string

@description('Static Web Apps region (westus2, centralus, eastus2, westeurope, eastasia)')
param location string = 'eastus2'

@allowed(['Free', 'Standard'])
param sku string = 'Free'

@description('Site slug — used for tagging so you can find and bill sites per client')
param slug string

@allowed(['personal', 'client'])
param owner string = 'personal'

resource site 'Microsoft.Web/staticSites@2023-12-01' = {
  name: name
  location: location
  tags: {
    managedBy: 'site-studio'
    site: slug
    owner: owner
  }
  sku: {
    name: sku
    tier: sku
  }
  properties: {
    // Content is pushed by GitHub Actions with a deployment token, not by
    // Azure's own repo integration, so no repositoryUrl here.
    stagingEnvironmentPolicy: 'Enabled'
    allowConfigFileUpdates: true
  }
}

output defaultHostname string = site.properties.defaultHostname
