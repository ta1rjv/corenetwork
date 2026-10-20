// ============================================================================
// CORENETWORK site configuration (edit this file before going live).
//
// PLACEHOLDER VALUES THAT MUST BE REPLACED:
//   phone         : "+90 (000) 000 00 00"            -> real phone number
//   phoneHref     : "tel:+900000000000"              -> tel: link matching the phone
//   email         : "info@ornek-alanadi.com"         -> public contact e-mail
//   quoteEmail    : "teklif@ornek-alanadi.com"       -> mailbox receiving quote requests
//   address       : sample address text              -> real postal address
//   workingHours  : sample working hours text        -> real working hours
//   social[]      : sample social profile URLs       -> real profile URLs (remove unused)
//   formEndpoint  : "" (empty)                       -> optional form backend URL.
//                   Empty = the quote form opens a mailto: draft to quoteEmail.
//                   Set = the form is POSTed (multipart form data) to this URL.
//   panelUrl      : "#"                              -> customer panel URL
//   speedTestUrl  : sample URL                       -> speed test page URL
//
// Values are injected into pages through data attributes:
//   data-cfg="key"        -> sets the element text to CONFIG[key]
//   data-cfg-href="key"   -> sets the element href to CONFIG[key]
//   data-socials          -> fills a <ul> with CONFIG.social links
// The HTML already contains the same defaults, so pages stay readable without JS.
// ============================================================================
export const CONFIG = {
  companyName: 'CORENETWORK',
  phone: '+90 (000) 000 00 00',
  phoneHref: 'tel:+900000000000',
  email: 'info@ornek-alanadi.com',
  emailHref: 'mailto:info@ornek-alanadi.com',
  quoteEmail: 'teklif@ornek-alanadi.com',
  address: 'Örnek Mahallesi, Örnek Caddesi No: 0, Örnek / Türkiye',
  workingHours: 'Pazartesi - Cuma, 09:00 - 18:00',
  social: [
    { label: 'LinkedIn', href: 'https://www.linkedin.com/company/ornek-firma' },
    { label: 'X', href: 'https://x.com/ornekfirma' },
    { label: 'Instagram', href: 'https://www.instagram.com/ornekfirma' },
  ],
  formEndpoint: '',
  panelUrl: '#',
  speedTestUrl: 'https://hiztesti.ornek-alanadi.com',
};
