export const ALPHA_ZIPS = [
    // Great Neck
    "11020", "11021", "11023", "11024", "11025", "11026", "11027",
    // New Hyde Park
    "11040", "11042", "11099"
];

export const isValidZip = (zip: string) => ALPHA_ZIPS.includes(zip);
