/** Published riwaya-to-Hafs references are required for books indexed by Hafs. */
export function tafsirReferences(ayah: { numberInSurah: number; audioNumber?: number; hafsNumbers?: number[] }): number[] {
  const published = Array.isArray(ayah.hafsNumbers) ? ayah.hafsNumbers.filter((value) => Number.isInteger(value) && value > 0) : []
  return published.length ? Array.from(new Set(published)) : [ayah.audioNumber || ayah.numberInSurah]
}
