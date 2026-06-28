// OFAC 제재 프로그램 코드 → 설명 (마우스오버 툴팁용).
import type { Lang } from '@/lib/i18n';

export const PROGRAM_INFO: Record<string, { ko: string; en: string }> = {
  SDGT: { ko: '특별지정 글로벌 테러리스트', en: 'Specially Designated Global Terrorist' },
  FTO: { ko: '외국 테러조직', en: 'Foreign Terrorist Organization' },
  NPWMD: { ko: '대량살상무기 확산 방지', en: 'Non-Proliferation of WMD' },
  TCO: { ko: '초국가 범죄조직', en: 'Transnational Criminal Organization' },
  SDNTK: { ko: '특별지정 마약거래자(킹핀법)', en: 'Specially Designated Narcotics Trafficker (Kingpin Act)' },
  'ILLICIT-DRUGS-EO14059': { ko: '불법 마약 거래 제재 (행정명령 14059)', en: 'Illicit Drug Trafficking (EO 14059)' },
  CAATSA: { ko: '미국 적성국 제재법 (러·이란·북한 대응)', en: "Countering America's Adversaries Through Sanctions Act" },
  CYBER2: { ko: '사이버 악성행위 제재 (행정명령 13694)', en: 'Cyber-related Sanctions (EO 13694)' },
  CYBER3: { ko: '사이버 악성행위 제재', en: 'Cyber-related Sanctions' },
  CYBER4: { ko: '사이버 악성행위 제재', en: 'Cyber-related Sanctions' },
  'ELECTION-EO13848': { ko: '미국 선거 개입 제재 (행정명령 13848)', en: 'Election Interference (EO 13848)' },
  DPRK2: { ko: '북한 제재', en: 'North Korea Sanctions' },
  DPRK3: { ko: '북한 제재', en: 'North Korea Sanctions' },
  DPRK4: { ko: '북한 제재', en: 'North Korea Sanctions' },
  IRAN: { ko: '이란 제재', en: 'Iran Sanctions' },
  'IRAN-EO13902': { ko: '이란 제재 (행정명령 13902·특정 부문)', en: 'Iran Sanctions (EO 13902)' },
  IFSR: { ko: '이란 금융제재 규정', en: 'Iran Financial Sanctions Regulations' },
  IRGC: { ko: '이란 혁명수비대', en: 'Islamic Revolutionary Guard Corps' },
  RUSSIA: { ko: '러시아 제재', en: 'Russia Sanctions' },
  'RUSSIA-EO14024': { ko: '러시아 제재 (행정명령 14024·유해 해외활동)', en: 'Russia Sanctions (EO 14024)' },
};

export function programDesc(code: string, lang: Lang): string {
  return PROGRAM_INFO[code]?.[lang] ?? code;
}
