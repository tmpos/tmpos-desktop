export type TaxProfile = {
  shortName: string
  fullName: string
  defaultRate: number
}

export type LocaleProfile = {
  country: string
  language: 'es' | 'en-US'
  locale: string
  currency: string
  currencySymbol: string
  dateFormat: string
  timeZone: string
  tax: TaxProfile
}

export const localeProfiles: Record<string, LocaleProfile> = {
  DO: { country: 'DO', language: 'es', locale: 'es-DO', currency: 'DOP', currencySymbol: 'RD$', dateFormat: 'DD/MM/YYYY', timeZone: 'America/Santo_Domingo', tax: { shortName: 'ITBIS', fullName: 'Impuesto sobre Transferencias de Bienes Industrializados y Servicios', defaultRate: 18 } },
  US: { country: 'US', language: 'en-US', locale: 'en-US', currency: 'USD', currencySymbol: '$', dateFormat: 'MM/DD/YYYY', timeZone: 'America/New_York', tax: { shortName: 'Sales Tax', fullName: 'Sales Tax', defaultRate: 0 } },
  MX: { country: 'MX', language: 'es', locale: 'es-MX', currency: 'MXN', currencySymbol: '$', dateFormat: 'DD/MM/YYYY', timeZone: 'America/Mexico_City', tax: { shortName: 'IVA', fullName: 'Impuesto al Valor Agregado', defaultRate: 16 } },
  CA: { country: 'CA', language: 'en-US', locale: 'en-CA', currency: 'CAD', currencySymbol: 'CA$', dateFormat: 'YYYY-MM-DD', timeZone: 'America/Toronto', tax: { shortName: 'GST/HST', fullName: 'Goods and Services Tax / Harmonized Sales Tax', defaultRate: 5 } },
  BR: { country: 'BR', language: 'es', locale: 'pt-BR', currency: 'BRL', currencySymbol: 'R$', dateFormat: 'DD/MM/YYYY', timeZone: 'America/Sao_Paulo', tax: { shortName: 'ICMS', fullName: 'Imposto sobre Circulação de Mercadorias e Serviços', defaultRate: 18 } },
  AR: { country: 'AR', language: 'es', locale: 'es-AR', currency: 'ARS', currencySymbol: '$', dateFormat: 'DD/MM/YYYY', timeZone: 'America/Argentina/Buenos_Aires', tax: { shortName: 'IVA', fullName: 'Impuesto al Valor Agregado', defaultRate: 21 } },
  CO: { country: 'CO', language: 'es', locale: 'es-CO', currency: 'COP', currencySymbol: '$', dateFormat: 'DD/MM/YYYY', timeZone: 'America/Bogota', tax: { shortName: 'IVA', fullName: 'Impuesto sobre las Ventas', defaultRate: 19 } },
  CL: { country: 'CL', language: 'es', locale: 'es-CL', currency: 'CLP', currencySymbol: '$', dateFormat: 'DD/MM/YYYY', timeZone: 'America/Santiago', tax: { shortName: 'IVA', fullName: 'Impuesto al Valor Agregado', defaultRate: 19 } },
  PE: { country: 'PE', language: 'es', locale: 'es-PE', currency: 'PEN', currencySymbol: 'S/', dateFormat: 'DD/MM/YYYY', timeZone: 'America/Lima', tax: { shortName: 'IGV', fullName: 'Impuesto General a las Ventas', defaultRate: 18 } },
  PA: { country: 'PA', language: 'es', locale: 'es-PA', currency: 'PAB', currencySymbol: 'B/.', dateFormat: 'DD/MM/YYYY', timeZone: 'America/Panama', tax: { shortName: 'ITBMS', fullName: 'Impuesto a la Transferencia de Bienes Muebles y Servicios', defaultRate: 7 } },
  CR: { country: 'CR', language: 'es', locale: 'es-CR', currency: 'CRC', currencySymbol: '₡', dateFormat: 'DD/MM/YYYY', timeZone: 'America/Costa_Rica', tax: { shortName: 'IVA', fullName: 'Impuesto al Valor Agregado', defaultRate: 13 } },
  GT: { country: 'GT', language: 'es', locale: 'es-GT', currency: 'GTQ', currencySymbol: 'Q', dateFormat: 'DD/MM/YYYY', timeZone: 'America/Guatemala', tax: { shortName: 'IVA', fullName: 'Impuesto al Valor Agregado', defaultRate: 12 } },
  PR: { country: 'PR', language: 'es', locale: 'es-PR', currency: 'USD', currencySymbol: '$', dateFormat: 'MM/DD/YYYY', timeZone: 'America/Puerto_Rico', tax: { shortName: 'IVU', fullName: 'Impuesto sobre Ventas y Uso', defaultRate: 11.5 } },
}

export function getLocaleProfile(country = localStorage.getItem('sistema_pais') || 'DO'): LocaleProfile {
  const base = localeProfiles[country] || localeProfiles.DO
  const customName = localStorage.getItem('sistema_impuesto_nombre') || ''
  const customFullName = localStorage.getItem('sistema_impuesto_nombre_completo') || ''
  const customRate = Number(localStorage.getItem('sistema_impuesto_porcentaje'))
  return {
    ...base,
    tax: {
      shortName: customName || base.tax.shortName,
      fullName: customFullName || customName || base.tax.fullName,
      defaultRate: Number.isFinite(customRate) && customRate >= 0 ? customRate : base.tax.defaultRate,
    },
  }
}

export function getTaxName(country?: string): string {
  return getLocaleProfile(country).tax.shortName
}
