/** Hafs references from https://api.quran.com/api/v4/juzs; pages use the 604-page Madani mushaf. */
const ranges = [
  [1, 1, 2, 141, 1], [2, 142, 2, 252, 22], [2, 253, 3, 92, 42],
  [3, 93, 4, 23, 62], [4, 24, 4, 147, 82], [4, 148, 5, 81, 102],
  [5, 82, 6, 110, 121], [6, 111, 7, 87, 142], [7, 88, 8, 40, 162],
  [8, 41, 9, 92, 182], [9, 93, 11, 5, 201], [11, 6, 12, 52, 222],
  [12, 53, 14, 52, 242], [15, 1, 16, 128, 262], [17, 1, 18, 74, 282],
  [18, 75, 20, 135, 302], [21, 1, 22, 78, 322], [23, 1, 25, 20, 342],
  [25, 21, 27, 55, 362], [27, 56, 29, 45, 382], [29, 46, 33, 30, 402],
  [33, 31, 36, 27, 422], [36, 28, 39, 31, 442], [39, 32, 41, 46, 462],
  [41, 47, 45, 37, 482], [46, 1, 51, 30, 502], [51, 31, 57, 29, 522],
  [58, 1, 66, 12, 542], [67, 1, 77, 50, 562], [78, 1, 114, 6, 582],
]

/** Every section maps these references to the selected reading's own ayah numbers. */
export const HAFS_JUZ_RANGES = ranges.map(([surah, ayah, endSurah, endAyah, page], index) => ({
  number: index + 1, page, start: { surah, ayah }, end: { surah: endSurah, ayah: endAyah },
}))
