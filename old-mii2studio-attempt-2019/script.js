// miiMap2Studio converts a mii "map" array with mii traits to a value that can be rendered by studio.mii.nintendo.com.
function miiMap2Studio(map) {
	// map will be modified
	const len = map.length;
  // make some random int
  const random = Math.floor(256 * Math.random());
  // randomCopy will be modified
  var randomCopy = random;
  for(let i = 0; i < len; i++) {
  	map[i] = (7 + (map[i] ^ randomCopy)) % 256;
    randomCopy = map[i];
  }
  return [random].concat(map).map(i => {
  	for(var byte = (i % 256).toString(16); byte.length < 2;) {
    	byte = '0' + byte;
    }
    return byte;
  }).join('');
}

// u8Mii2Map converts a uint8array of a mii in bytes (can be converted from a base64 mii) to a mii "map" struct which can then be used in miiMap2Studio
function u8Mii2Map(u8) {
	// u8 is a Uint8Array that shouldn't be modified
  return [
  	// unknown?
  	8,
    // beard type (0 for none)
    0,
    // fatness
    u8[0x2f],
    // eye thickness
    u8[0x35] >> 0x05,
    // eye color (!)
    (u8[0x34] & 0x01) + (u8[0x35] >> 0x06),
    // eye rotation
    u8[0x36] & 0x07,
    // eye scale (!)
    (0x0e & u8[0x35]) >> 0x01,
    // eye type
    u8[0x34] & 0x3f,
    // eye distance
    u8[0x36] >> 0x05,
    // eye height
    (u8[0x37] & 0x1f) >> 0x01,
    // eyebrow thickness
    (0x0e & u8[0x3a]) >> 0x01,
    // eyebrow color
    u8[0x38] >> 0x05,
    // eyebrow rotation
    u8[0x3a] & 0x07,
    // eyebrow scale
    u8[0x39] & 0x07,
    // eyebrow type (!)
    u8[0x38] & 0x05,
    // eyebrow distance
    (u8[0x3b] & 0x01) + (u8[0x3a] >> 0x05),
    // eyebrow height
    u8[0x3b] >> 0x01,
    // face color (!)
    u8[0x30] >> 0x05,
    // blush type (0 for none)
    u8[0x30] >> 0x04,
    // face type (!!)
    (0x0e & u8[0x30]) >> 0x01,
    // face style (wrinkles) (0 for none)
    u8[0x31] & 0x0f,
    // shirt color
    (0x3c & u8[0x19]) >> 0x02,
    // male/female
    u8[0x18] & 0x01,
    // unknown?
    8,
    // unknown?
    4,
    // glasses type (0 for none)
    0,
    // glasses height
    10,
    // hair color (!)
    u8[0x33] & 0x06,
    // hair flipped (!)
    u8[0x33] >> 0x03,
    // hair style
    u8[0x32],
    // height
    u8[0x2e],
    // unknown?
    4,
    // mole enabled
    0,
    // mole x
    2,
    // mole y
    20,
    // mouth thickness
    3,
    // unknown?
    19,
    // mouth size
    3,
    // mouth type
    25,
    // mouth height
    13,
    // unknown?
    4,
    // moustache type (0 for none)
    0,
    // moustache height
    10,
    // nose scale
    1,
    // nose type
    0x1f & u8[0x3c],
    // nose height
    (u8[0x3d] & 0x1f) >> 0x01,
  ];
}

// b642u8 idio(t)matically converts a base64 string to a uint8array
function b642u8(str) {
	const binaryStr = atob(str);
  const len = binaryStr.length;
  var u8 = new Uint8Array(len);
  for(let i = 0; i < len; i++) {
  	u8[i] = binaryStr.charCodeAt(i);
  }
  return u8;
}

// do stuff
// convert base64 to u8
//const newMiiMap = u8Mii2Map(b642u8('AwAAMKtmz7kOsnHolemSncz7ZfBbsAAAAWBUAGEAbgB1AGsAaQBEAGUAZQAAADcjAABpAa1oYxggNEYWgRJPaA0AACkgYkhQAAAAAAAAAAAAAAAAAAAAAAAAAAAAABnp'));
const newMiiMap = u8Mii2Map(b642u8('AwAAMLYhkwbv2enqkdzbyFi9o+5zsgAAk2qGMAAAWDAxAGsAMQAyAGQAVTCTMFFDEhBlBhJkpBzAYGYWAgrCBAYAAClAABAAhjBEMAAAAAAAAAAAAAAAAAAAAAAAAAnv'));
//const newMiiMap = u8Mii2Map(b642u8('AwEAMIAhWGSARACgkc32dOAMf+R8aQAAWFhQAEYAMgBNAAAAUABGADIATQAAAH8uCAAzBqUoQxLhI2UOgRIVZg4AIEEAUhAdTABhAG4AZQAAAAAAAAAAAAAAAAAAAPln'));
//const newMiiMap = u8Mii2Map(b642u8('AwEAQOiHu+XgBGBQ1wSZbRghyJwF/wAAWRhQAEYAMgBHAAAAUABGADIATQAAAH8uCAAMBrtqQhThI2UOYRIIRA4AIEEAUhAdAABhAG4AZQAAAAAAAAAAAAAAAAAAAKz5'));
const newMiiStudioValue = miiMap2Studio(newMiiMap);
// here is the actual mii studio image url
const miiStudioURL = 'https://studio.mii.nintendo.com/miis/image.png?type=all_body&width=270&data=' + newMiiStudioValue;
// update img
document.getElementById('mii-preview').setAttribute('src', miiStudioURL);