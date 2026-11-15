// PSGC Address API: Region -> Province -> City/Municipality -> Barangay
const BASE = 'https://psgc.gitlab.io/api';

export type Place = { code: string; name: string };

async function get(path: string): Promise<Place[]> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error('Could not load address data');
  const data = (await res.json()) as Place[];
  return data
    .map(({ code, name }) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export const getRegions = () => get('/regions/');
export const getProvinces = (regionCode: string) =>
  get(`/regions/${regionCode}/provinces/`);
export const getCitiesByProvince = (provinceCode: string) =>
  get(`/provinces/${provinceCode}/cities-municipalities/`);
// Some regions (e.g. NCR) have no provinces
export const getCitiesByRegion = (regionCode: string) =>
  get(`/regions/${regionCode}/cities-municipalities/`);
export const getBarangays = (cityCode: string) =>
  get(`/cities-municipalities/${cityCode}/barangays/`);
