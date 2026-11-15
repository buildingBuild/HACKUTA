/** Illustrative ordinary mentorship rules. Not FaZe guest rates or an established benefit. */
export const pricingConfig = {
  currency:'USD', version:'illustrative-v1',
  rates:{1:6000,2:11000},
  tiers:[{minimum:500,percent:10},{minimum:100,percent:5}],
  capPercent:10,
  mentorRates:{review:{1:6000,2:11000},workshop:{2:12000}},
} as const;
export type Hours=1|2;
export interface PriceQuote { version:string;currency:string;hours:Hours;regularCents:number;discountPercent:number;discountCents:number;totalCents:number;karma:number|null;karmaVerified:boolean;mentorId?:string }
export function quotePrice(hours:Hours,karma:number|null,verified:boolean,mentorId?:string):PriceQuote {
  if(hours!==1&&hours!==2)throw new Error('Choose a one- or two-hour session.');
  const rates=mentorId?pricingConfig.mentorRates[mentorId as keyof typeof pricingConfig.mentorRates]:pricingConfig.rates;
  const regularCents=rates?.[hours as keyof typeof rates];
  if(!Number.isSafeInteger(regularCents)||regularCents<=0)throw new Error('This duration is not offered by the selected mentor.');
  const karmaVerified=verified&&typeof karma==='number'&&Number.isSafeInteger(karma);
  const percent=karmaVerified?(pricingConfig.tiers.find(t=>karma!>=t.minimum)?.percent??0):0;
  const discountPercent=Math.max(0,Math.min(pricingConfig.capPercent,percent));
  const discountCents=Math.min(regularCents,Math.round(regularCents*discountPercent/100));
  return {...(mentorId?{mentorId}:{}),version:pricingConfig.version,currency:pricingConfig.currency,hours,regularCents,discountPercent,discountCents,totalCents:Math.max(0,regularCents-discountCents),karma:karmaVerified?karma:null,karmaVerified};
}
export const money=(cents:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:pricingConfig.currency,maximumFractionDigits:2}).format(cents/100);
