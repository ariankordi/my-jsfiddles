// @ts-check

/* eslint @stylistic/indent: ['error', 2] -- Define indent rules. */
/* eslint no-var: "off", prefer-const: 'off', -- Configure for ES5 environment. */

/* eslint class-methods-use-this: 'off' -- Intentional. */
/* eslint unicorn/prefer-dom-node-append: 'off' -- Incompatible with ES5 browsers.  */
/* eslint unicorn/prefer-blob-reading-methods: 'off' -- Incompatible with ES5 browsers. */
/* eslint unicorn/prefer-add-event-listener: 'off' -- Not sure */

// read the bottom of the file for official CFL structs!
var CFL_DB_IDENTIFIER = 'CFOG';
var FFL_ODB_IDENTIFIER = 'FFOC';

/** Starting offset of the name in FFLiMiiDataCore/Ver3StoreData. */
var NAME_OFFSET = 0x1A;
/** Length for Mii names as UTF-16 characters. */
var MAX_NAME_LENGTH = 10;

function swap16(/** @type {Uint8Array} */ data, /** @type {number} */ offset) {
  const b0 = data[offset];
  const b1 = data[offset + 1];
  data[offset] = b1;
  data[offset + 1] = b0;
}
function swap32(/** @type {Uint8Array} */ data, /** @type {number} */ offset) {
  var b0 = data[offset];
  var b1 = data[offset + 1];
  var b2 = data[offset + 2];
  var b3 = data[offset + 3];
  data[offset] = b3;
  data[offset + 1] = b2;
  data[offset + 2] = b1;
  data[offset + 3] = b0;
}

/**
 * Perform endian swapping on FFLiMiiDataOfficial.
 * @param {Uint8Array} data - The 92-byte FFLiMiiDataOfficial data.
 */
function swapFFLiMiiDataOfficial(data) {
  // Reference: https://github.com/aboood40091/ffl/blob/73fe9fc70c0f96ebea373122e50f6d3acc443180/src/FFLiMiiDataCore.cpp#L6-L14
  swap32(data, 0);
  // authorID (8) + createID (10) + reserved (2) = 20 byte skip
  var i;
  for (i = 0; i < 22; i += 2) {
    // gender, birthDate, favoriteColor, name
    swap16(data, 24 + i);
  }
  // reserved (2) + (11 * 2) = 24 byte skip
  for (i = 0; i < 24; i += 2) {
    swap16(data, 48 + i); // uh
  }
  for (i = 0; i < 20; i += 2) {
    swap16(data, 72 + i); // creatorName
  }
}

/**
 * Calculates the CRC-16/CCITT checksum for the specified input data.
 * Courtesy of Luciano Barcaro: https://stackoverflow.com/a/30357446
 * @param {Uint8Array} input - The byte array containing the data over which to compute the checksum.
 * @param {number} length - The number of bytes from the input array to process.
 * @returns {number} The calculated CRC-16/CCITT checksum as a number.
 */
function crc16(input, length) {
  /** Starting CRC value. */
  var crc = 0x0000;

  /** The most significant byte (MSB) from the initial CRC. Obtained by shifting right 8 bits. */
  var msb = crc >> 8;
  /** The least significant byte (LSB) from the initial CRC. Mask with 0xFF to get only the lower 8 bits. */
  var lsb = crc & 0xFF;

  // Process each byte in the input.
  for (var i = 0; i < length; i++) {
    // XOR the byte value with the current MSB.
    // This step introduces the data into the checksum calculation.
    var x = input[i] ^ msb;
    // Combine bits within x to further scramble the bits.
    x ^= (x >> 4); // XOR with its right-shifted value by 4 bits.

    // Compute the new MSB value:
    // - Start with the previous LSB value.
    // - XOR with x shifted right by 3 bits to bring in bits from lower positions.
    // - XOR with x shifted left by 4 bits to mix in higher-order bits.
    // - Finally, mask with 0xFF to ensure the result stays within 8 bits.
    msb = (lsb ^ (x >> 3) ^ (x << 4)) & 0xFF;
    // Compute the new LSB value:
    // - XOR x with x shifted left by 5 bits.
    // - Mask with 0xFF to maintain an 8-bit result.
    lsb = (x ^ (x << 5)) & 0xFF;
  }

  // Combine the two bytes into one 16-bit value.
  // The MSB is shifted left by 8 bits to occupy the high-order byte.
  // The LSB occupies the low-order byte.
  return (msb << 8) | lsb;
}

/**
 * Converts and optionally swaps FFLiMiiDataOfficial data to StoreData.
 * Adds a CRC-16/CCITT/XMODEM using {@link crc16}.
 * @param {Uint8Array} dst - Destination buffer for StoreData. Must be 96 bytes.
 * @param {Uint8Array} src - The source FFLiMiiDataOfficial data.
 */
function convOfficialToStore(dst, src) {
  dst.set(src);

  var crc = crc16(dst, 94);
  var dv = new DataView(dst.buffer);
  dv.setUint16(94, crc, false);
}

/**
 * Convert a Uint8Array to a Base64 string.
 * @param {Uint8Array} bytes - The byte array to convert.
 * @returns {string} The Base64 encoded string.
 */
function bytesToBase64(bytes) {
  var binary = '';
  for (var i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert a UTF-16 encoded name to a string.
 * @param {Uint8Array} data - The byte array containing the UTF-16 name.
 * @param {number} offset - The offset where the name starts.
 * @param {number} maxLength - The maximum length of the name in characters.
 * @returns {string} The decoded UTF-16 name as a string.
 */
function decodeUtf16Le(data, offset, maxLength) {
  var name = '';
  for (var i = 0; i < maxLength; i++) {
    var charCode = (data[offset + 1] << 8) | data[offset];

    // Stop if null terminator is encountered
    if (charCode === 0) {
      break;
    }

    name += String.fromCharCode(charCode);
    offset += 2;
  }
  return name;
}

function areAllZeros(/** @type {ArrayLike<number>} */ arr) {
  for (var i = 0; i < arr.length; i++) {
    if (arr[i] !== 0) {
      return false;
    }
  }
  return true;
}

/**
 * @typedef {Object} MiiDatabaseOfficial
 * @property {function(): number} getFileSize
 * @property {function(): number} getDataSize
 * @property {function(): number} getDataNum
 * @property {function(): boolean} isLittleEndian
 * @property {function(Uint8Array, number): Uint8Array} getCharData
 * @property {function(Uint8Array): boolean} isDataEmpty
 */

class MiiDatabaseOfficialCafe {
  /** @private */
  static FILE_SIZE = 276544;

  /** @private */
  static CHAR_DATA_SIZE = 0x5c;

  /** @private */
  static DATA_NUM = 3000;

  static getFileSize() {
    return MiiDatabaseOfficialCafe.FILE_SIZE;
  }

  static getDataSize() {
    return MiiDatabaseOfficialCafe.CHAR_DATA_SIZE;
  }

  static getDataNum() {
    return MiiDatabaseOfficialCafe.DATA_NUM;
  }

  static isLittleEndian() {
    return false;
  }

  /** gets the index of the character data */
  static getOffset(/** @type {number} */ index) {
    // GetImpl__24FFLiDatabaseFileOfficialCFUs
    return 8 + (index * 0x5c);
  }

  /** gets the character data entry at the index */
  static getCharData(/** @type {Uint8Array} */ data, /** @type {number} */ index) {
    const begin = MiiDatabaseOfficialCafe.getOffset(index);
    const end = begin + MiiDatabaseOfficialCafe.CHAR_DATA_SIZE;
    const charData = data.subarray(begin, end);
    return charData;
  }

  /** checks if the character data entry is empty/invalid */
  static isDataEmpty(/** @type {Uint8Array} */ data) {
    const createId = data.subarray(12, 22);
    return areAllZeros(createId);
  }
}

class MiiDatabaseOfficialCtr {
  static getFileSize() {
    return 310560;
  }

  static getDataSize() {
    return 0x5C;
  }

  static getDataNum() {
    return 100;
  }

  static isLittleEndian() {
    return true;
  }

  /** gets the index of the character data */
  static getOffset(/** @type {number} */ index) {
    // GetImpl__24FFLiDatabaseFileOfficialCFUs
    return 8 + (index * 0x5C);
  }

  /** gets the character data entry at the index */
  static getCharData(/** @type {Uint8Array} */ data, /** @type {number} */ index) {
    const begin = MiiDatabaseOfficialCtr.getOffset(index);
    const end = MiiDatabaseOfficialCtr.getOffset(index + 1);
    const charData = data.subarray(begin, end);
    return charData;
  }

  /** checks if the character data entry is empty/invalid */
  static isDataEmpty(/** @type {Uint8Array} */ data) {
    const createId = data.subarray(12, 22);
    return areAllZeros(createId);
  }
}

class MiiDatabaseOfficialRfl {
  static getFileSize() {
    return 779968;
  }

  static getDataSize() {
    return 0x4A;
  }

  static getDataNum() {
    return 100;
  }

  static isLittleEndian() {
    return false;
  }

  /** gets the index of the character data */
  static getOffset(/** @type {number} */ index) {
    return 4 + (index * 0x4A);
  }

  /** gets the character data entry at the index */
  static getCharData(/** @type {Uint8Array} */ data, /** @type {number} */ index) {
    const begin = MiiDatabaseOfficialRfl.getOffset(index);
    const end = MiiDatabaseOfficialRfl.getOffset(index + 1);
    const charData = data.subarray(begin, end);
    return charData;
  }

  /** checks if the character data entry is empty/invalid */
  static isDataEmpty(/** @type {Uint8Array} */ data) {
    const createId = data.subarray(24, 32);
    return areAllZeros(createId);
  }
}

class MiiDatabaseAccessor {
  constructor(/** @type {MiiDatabaseOfficial} */ db, /** @type {Uint8Array} */ dataArray) {
    /** @private */ this._db = db;
    /** @private */ this._dataArray = dataArray;
  }

  getCharData(/** @type {number} */ index) {
    return this._db.getCharData(this._dataArray, index);
  }

  getNonEmptyNum() {
    let num = 0;
    for (let i = 0; i < this._db.getDataNum(); i++) {
      const data = this.getCharData(i);
      if (!this._db.isDataEmpty(data)) {
        num += 1;
      }
    }
    return num;
  }

  getCharDataAll() {
    const num = this._db.getDataNum();
    /** @type {Array<Uint8Array>} */
    const out = Array.from({ length: num });
    let current = 0;
    for (let i = 0; i < num; i++) {
      const data = this.getCharData(current);
      if (!this._db.isDataEmpty(data)) {
        out[current++] = data;
      }
    }
    return out;
  }
}

/**
 * @typedef {{storeDataArray: Array<Uint8Array>,
 * characterNames: Array<string|null>, nonEmptyNum: number}} StoreDataArray
 */

/**
 * Process the uploaded FFL_ODB.dat file and display valid Mii data.
 * @param {Uint8Array} uint8Array - The file data.
 * @returns {StoreDataArray} An array of data from the FFL_ODB.
 * @throws {Error}
 */
function getStoreDataArrayFromDB2(uint8Array) {
  // Verify the identifier, which is the first 4 bytes.
  var magic = '';
  var i;
  for (i = 0; i < 4; i++) {
    magic += String.fromCharCode(uint8Array[i]);
  }

  var db;
  switch (magic) {
    case 'CFOG':
      db = MiiDatabaseOfficialCtr;
      break;
    case 'FFOC':
      db = MiiDatabaseOfficialCafe;
      break;
    case 'RNOD':
      db = MiiDatabaseOfficialRfl;
      break;
    case 'CFOF':
      throw new Error('does not support mid-2010 CFL_DB.dat sorry');
    default:
      throw new Error('unknown magic');
  }

  const database = new MiiDatabaseAccessor(db, uint8Array);

  if (uint8Array.length !== db.getFileSize()) {
    throw new Error('getStoreDataArrayFromDB: wrong file size. Actual size: ' + uint8Array.length);
  }

  const nonEmptyNum = database.getNonEmptyNum();
  const storeDataArray = database.getCharDataAll();
  const characterNames = Array.from({ length: nonEmptyNum });

  const dataSz = db.getDataSize();
  const swapEndian = dataSz === 92 && !db.isLittleEndian();
  for (/* var */i = 0; i < nonEmptyNum; i++) {
    if (swapEndian) { // Perform endian swapping.
      swapFFLiMiiDataOfficial(storeDataArray[i]);
    }
    convOfficialToStore(storeDataArray[i], storeDataArray[i]);
    // Decode UTF-16 name.
    if (dataSz === 74) {
      const leName = storeDataArray[i].slice(2, 22);
      const dv = new DataView(leName.buffer);
      for (var j = 0; j < 10; j++) {
        dv.setUint16(j, dv.getUint16(j, false), true);
      }
      characterNames[i] = decodeUtf16Le(leName, 0, 10);
    } else if (dataSz === 92) {
      characterNames[i] = decodeUtf16Le(storeDataArray[i], 0x1A, 10);
    }
  }

  return {
    storeDataArray,
    characterNames,
    nonEmptyNum
  };
}

/**
 * Display the list of valid Mii Base64 strings in the HTML.
 * @param {StoreDataArray} miis - Array of Mii objects containing name,
 * roomIndex, positionInRoom, and Base64 data.
 */
function displayStoreDataArray(miis) {
  var ul = document.getElementById('miiList');
  if (!ul) {
    alert('displayMiis: Element with ID "miiList" does not exist.');
    return;
  }
  ul.innerHTML = ''; // Clear any existing content

  // Add text format description
  /*
            var formatDesc = document.createElement('li');
            formatDesc.textContent = 'Format: Name (Room Index/Position In Room): Base64 Data';
            ul.appendChild(formatDesc);
     */

  for (var i = 0; i < miis.nonEmptyNum; i++) {
    var name = miis.characterNames[i];
    var data = miis.storeDataArray[i];

    var li = document.createElement('li');

    // Prefix with Name and Room Info
    li.textContent = name + '\n'; // `${miis[i].name} (${miis[i].roomIndex}/${miis[i].positionInRoom}): `;

    // Encode data to Base64
    var base64Data = bytesToBase64(data);
    // Add Base64 in a code block
    var codeBlock = document.createElement('code');
    codeBlock.textContent = base64Data;
    li.appendChild(codeBlock);

    // Add inner bullet with image
    var innerUl = document.createElement('ul');
    var innerLi = document.createElement('li');
    innerLi.innerHTML = '<img loading="lazy" src="https://mii-unsecure.ariankordi.net/miis/image.png?width=96&data=' + encodeURIComponent(base64Data) + '"><br>';
    innerUl.appendChild(innerLi);
    li.appendChild(innerUl);

    ul.appendChild(li);
  }

  // Inform the user if no valid Miis were found
  if (miis.nonEmptyNum <= 0) {
    li = document.createElement('li');
    li.textContent = 'No valid Mii data found.';
    ul.appendChild(li);
  }
}

/**
 * Handle the file input change event.
 * @param {Event} event - The change event.
 */
function handleFileSelect(event) {
  var target = /** @type {HTMLInputElement} */ (event.target);
  if (!target || !target.files || !target.files[0]) {
    alert('No file selected.');
    return;
  }

  var file = target.files[0];

  var reader = new FileReader();

  reader.onload = function (e) {
    var arrayBuffer = /** @type {FileReader} */ (e.target).result;
    if (!(arrayBuffer instanceof ArrayBuffer)) {
      console.error('handleFileSelect / reader.onload: FileReader.result is not ArrayBuffer.');
      return;
    }

    try {
      var array = getStoreDataArrayFromDB2(new Uint8Array(arrayBuffer));
    } catch (e) {
      alert(e);
      throw e;
    }
    displayStoreDataArray(array);
  };

  reader.onerror = function () {
    alert('handleFileSelect / reader.onerror: Error reading file.');
  };

  // Read the file as ArrayBuffer for binary processing
  reader.readAsArrayBuffer(file);
}

// Uncomment the following block to use NWF's file reading implementation

/**
 * NWF File Reading Implementation
 * @param {Event & {data: Blob}} evt - The read event from NWF.
 */
function onFFLODBRead(evt) {
  // Check if evt.data is a Blob
  if (!evt.data) {
    alert('onFFLODBRead: evt.data is null or undefined.');
    return;
  }

  /** Define the Blob from the event. */
  var blob = evt.data;
  var reader = new FileReader();

  reader.onloadend = function () {
    if (!reader.result) {
      alert('onFFLODBRead: reader.result is null or undefined, failed to read Blob content.');
      return;
    }
    // Convert text content to an ArrayBuffer
    /** Result of the reader, which is expected to be a string. */
    var textData = reader.result;
    if (typeof textData !== 'string') {
      alert('onFFLODBRead / reader.onloadend: FileReader.result type is unexpectedly not string');
      return;
    }
    var bytes = new Uint8Array(textData.split('').map(
      /**
       * @param {string} char - The character as a string.
       * @returns {number} The byte index of the character.
       */
      function (char) {
        return char.charCodeAt(0);
      }));

    try {
      var array = getStoreDataArrayFromDB2(bytes);
    } catch (e) {
      alert(e);
      throw e;
    }
    displayStoreDataArray(array);
  };

  reader.onerror = function () {
    alert('onFFLODBRead / reader.onerror: Could not read Blob.');
  };

  // Read the Blob as text
  reader.readAsBinaryString(blob); // Use binary string to match expected content format
}

/*
function onFFLODBReadFail() {
    alert('nwf.events.IOEvent.ERROR / Failed to read FFL_ODB.dat file.');
}
// Initialize NWF file reading on document ready
document.addEventListener('DOMContentLoaded', function () {
    try {
        var directory = new nwf.io.Directory("/vol/storage_mlc01/usr/save/00050010/1004a100/user/common/db/");
        var files = directory.listFiles();
        var FFL_ODB;

        for (var i = 0; i < files.length; i++) {
            if (files[i].fileName === "FFL_ODB" && files[i].fileExtension === "dat") {
                FFL_ODB = new nwf.io.File('FFL_ODB.dat', directory);
                FFL_ODB.addEventListener(nwf.events.IOEvent.READ_COMPLETE, onFFLODBRead);
                FFL_ODB.addEventListener(nwf.events.IOEvent.ERROR, onFFLODBReadFail);
                FFL_ODB.read();
                break;
            }
        }
    } catch (error) {
        alert("An error occurred while accessing the directory: " + error.message);
    }
});
*/
// Polyfill for btoa (base64 encoding) if not available.
// https://github.com/MaxArt2501/base64-js/blob/master/base64.js
if (!window.btoa) {
  // base64 character set, plus padding character (=)
  var b64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  window.btoa = function (string) {
    string = String(string);
    var bitmap;
    var a;
    var b;
    var c;
    var result = '';
    var i = 0;
    var rest = string.length % 3; // To determine the final padding

    for (; i < string.length;) {
      if ((a = string.charCodeAt(i++)) > 255 ||
        (b = string.charCodeAt(i++)) > 255 ||
        (c = string.charCodeAt(i++)) > 255) {
        throw new TypeError('Failed to execute \'btoa\' on \'Window\': The string to be encoded contains characters outside of the Latin1 range.');
      }

      bitmap = (a << 16) | (b << 8) | c;
      result += b64.charAt(bitmap >> 18 & 63) + b64.charAt(bitmap >> 12 & 63) +
        b64.charAt(bitmap >> 6 & 63) + b64.charAt(bitmap & 63);
    }

    // If there's need of padding, replace the last 'A's with equal signs
    return rest ? result.slice(0, rest - 3) + '==='.substring(rest) : result;
  };
}

// Ensure the DOM is loaded before attaching event listeners
document.addEventListener('DOMContentLoaded', function () {
  var fileInput = document.getElementById('fileInput');
  if (fileInput && fileInput.addEventListener) {
    fileInput.addEventListener('change', handleFileSelect, false);
  } else {
    alert('Could not find element fileInput.');
  }
});

// NOTE that CFL_DB.dat contains more interesting data!!!!
/*

struct CFLiCharDatabase {
    u32 identifier; // magic: CFOG (0x474f4643)
    u32 myMiiIndex:8;
    u32 isolation:1;
    u32 padding_0:23;
    struct CFLiPackedMiiDataOfficial rawdata[100]; // 92 bytes
    struct CFLiHiddenHeader hidden;
    u8 padding_1[14];
    u16 crc;
};

// For reference, from FFL decomp (https://github.com/aboood40091/ffl/blob/73fe9fc70c0f96ebea373122e50f6d3acc443180/include/nn/ffl/FFLiDatabaseFileOfficial.h#L42)
class FFLiDatabaseFileOfficial
{
...
private:
    u32                 m_Magic; // magic: FFOC (0x46464f43)
    u32                 m_SaveCount;
    FFLiMiiDataOfficial m_MiiDataOfficial[3000]; // 92 bytes
    FFLCreateID         m_CreateID[50]; // 10 bytes
    // Not written to by Mii Maker(?):
    u16                 _4381c[34 / sizeof(u16)];
    u16                 m_Crc;
}
*/

// export { processFFLODB };
