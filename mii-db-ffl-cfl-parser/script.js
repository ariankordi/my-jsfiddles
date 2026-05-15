'use strict';
// @ts-check

/* eslint @stylistic/indent: ['error', 2] -- Define indent rules. */

/* eslint unicorn/prefer-module: 'off' -- Do not care. */
/* eslint class-methods-use-this: 'off' -- Intentional. */
/* eslint unicorn/prefer-dom-node-append: 'off' -- Incompatible with ES5 browsers.  */
/* eslint unicorn/prefer-blob-reading-methods: 'off' -- Incompatible with ES5 browsers. */
/* eslint unicorn/prefer-add-event-listener: 'off' -- Not sure */

function swap16All(/** @type {Uint8Array} */ data,
  /** @type {number} */ offset, /** @type {number} */ count = 1) {
  for (let i = 0; i < count; i++) {
    const idx = i * 2;
    const b0 = data[offset + idx];
    const b1 = data[offset + idx + 1];
    data[offset + idx] = b1;
    data[offset + idx + 1] = b0;
  }
}

function swap32(/** @type {Uint8Array} */ data, /** @type {number} */ offset) {
  const b0 = data[offset];
  const b1 = data[offset + 1];
  const b2 = data[offset + 2];
  const b3 = data[offset + 3];
  data[offset] = b3;
  data[offset + 1] = b2;
  data[offset + 2] = b1;
  data[offset + 3] = b0;
}

function swapEndianVer3MiiData(/** @type {Uint8Array} */ data,
  /** @type {boolean} */ hasCreator) {
  // Reference: https://github.com/aboood40091/ffl/blob/73fe9fc70c0f96ebea373122e50f6d3acc443180/src/FFLiMiiDataCore.cpp#L6-L14
  swap32(data, 0);
  // authorID (8) + createID (10) + reserved (2) = 20 byte skip
  // gender, birthDate, favoriteColor, name
  swap16All(data, 24, 11);
  // reserved (2) + (11 * 2) = 24 byte skip
  swap16All(data, 48, 12); // uh
  if (hasCreator) { // not for core data
    swap16All(data, 72, 10); // creatorName
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
  /** Starting CRC value. */ const crc = 0;

  /** The most significant byte (MSB) from the initial CRC. Obtained by shifting right 8 bits. */
  let msb = crc >> 8;
  /** The least significant byte (LSB) from the initial CRC. Mask with 0xFF to get only the lower 8 bits. */
  let lsb = crc & 0xFF;

  // Process each byte in the input.
  for (let i = 0; i < length; i++) {
    // XOR the byte value with the current MSB.
    // This step introduces the data into the checksum calculation.
    let x = input[i] ^ msb;
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

function ver3OfficialToStore(/** @type {Uint8Array} */ dst, /** @type {Uint8Array} */ src) {
  console.assert(dst.length === 96, 'expected destination array to be Ver3StoreData length');
  dst.set(src);
  const crc = crc16(dst, 94);
  const dv = new DataView(dst.buffer);
  dv.setUint16(94, crc, false);
  return dst;
}

/**
 * Convert a Uint8Array to a Base64 string.
 * @param {Uint8Array} bytes - The byte array to convert.
 * @returns {string} The Base64 encoded string.
 */
function bytesToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/** Convert a wide string (UTF-16) to a string. */
function decodeChar16(/** @type {Uint8Array} */ data, /** @type {number} */ offset,
  /** @type {number} */ length, /** @type {boolean} */ le = true) {
  // const data16 = new Uint16Array(data.buffer, data.byteOffset, data.byteLength).subarray(offset / 2);
  const view = new DataView(data.buffer, data.byteOffset + offset, length * 2);
  let name = '';
  let char;
  for (let i = 0; i < length &&
    (char = view.getUint16(i * 2, le)) !== 0; i++) {
    name += String.fromCharCode(char);
  }
  return name;
}

function areAllZeros(/** @type {ArrayLike<number>} */ arr) {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] !== 0) {
      return false;
    }
  }
  return true;
}

function nameFromCharData(/** @type {Uint8Array} */ data, /** @type {number} */ size) {
  switch (size) {
    case 76:
    case 74: // RFLCharData
      return decodeChar16(data, 2, 10, /* littleEndian= */ false);
    case 72:
    case 96:
    case 92: // FFLiMiiDataOfficial
      return decodeChar16(data, 0x1A, 10, /* littleEndian= */ true);
    case 48:
    case 68: // nn::mii::detail::StoreDataRaw
      return decodeChar16(data, 28, 10, /* littleEndian= */ true);
    default:
      throw new Error('unexpected character data length');
  }
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

class MiiDatabaseNx {
  static getFileSize() {
    return 6808;
  }

  static getDataSize() {
    return 68;
  }

  static getDataNum() {
    return 100;
  }

  static isLittleEndian() {
    return true;
  }

  /** gets the index of the character data */
  static getOffset(/** @type {number} */ index) {
    return 4 + (index * 68);
  }

  /** gets the character data entry at the index */
  static getCharData(/** @type {Uint8Array} */ data, /** @type {number} */ index) {
    const begin = MiiDatabaseNx.getOffset(index);
    const end = MiiDatabaseNx.getOffset(index + 1);
    const charData = data.subarray(begin, end);
    return charData;
  }

  /** checks if the character data entry is empty/invalid */
  static isDataEmpty(/** @type {Uint8Array} */ data) {
    const createId = data.subarray(0x30, 0x40);
    return areAllZeros(createId);
  }
}

class MiiDatabaseAccessor {
  constructor(/** @type {MiiDatabaseOfficial} */ db, /** @type {Uint8Array} */ dataArray) {
    /** @private */ this._db = db;
    /** @private */ this._dataArray = dataArray;

    if (dataArray.length !== db.getFileSize()) {
      throw new Error('MiiDatabaseAccessor.construct: wrong file size');
    }
  }

  /**
   * determines type of database file
   * @param {Uint8Array} bytes - database file contents
   * @returns {MiiDatabaseOfficial} database header class
   * @throws {Error} throws if the input is invalid or magic is not recognized
   */
  static getType(bytes) {
    // Ensure we can safely read the first 4 bytes.
    if (!(bytes instanceof Uint8Array) || bytes.length < 4) {
      throw new Error('expected Uint8Array with at least 4 bytes');
    }

    // Extract first four bytes as constants.
    const a = bytes[0], b = bytes[1], c = bytes[2], d = bytes[3];

    // RNOD: RVL Nigaoe Official Database
    if (a === 0x52 && b === 0x4E && c === 0x4F && d === 0x44) {
      return MiiDatabaseOfficialRfl;
    }
    // CFOF: CTR Face O(f)ficial (prototype)
    if (a === 0x43 && b === 0x46 && c === 0x4F && d === 0x46) {
      throw new Error('does not support mid-2010 CFL_DB.dat sorry');
    }
    // CFOG: CTR Face Official but they changed F -> G
    if (a === 0x43 && b === 0x46 && c === 0x4F && d === 0x47) {
      return MiiDatabaseOfficialCtr;
    }
    // FFOC: Ca(f)e Face Official... Cafe???
    if (a === 0x46 && b === 0x46 && c === 0x4F && d === 0x43) {
      return MiiDatabaseOfficialCafe;
    }
    // NFDB: NintendoSDK Face Library Database
    if (a === 0x4E && b === 0x46 && c === 0x44 && d === 0x42) {
      return MiiDatabaseNx;
    }
    // NFIF: NintendoSDK Face Library Import File
    if (a === 0x4E && b === 0x46 && c === 0x49 && d === 0x46) {
      throw new Error('nx NFIF file is not supported at this time');
    }

    throw new Error('unknown magic for db');
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
 * Array of character data.
 * @typedef {{dataArray: Array<Uint8Array>,
 * characterNames: Array<string|null>,
 * nonEmptyNum: number}} CharDataArray
 */

/**
 * Process the uploaded database file and display Mii data.
 * @param {Uint8Array} uint8Array - The file data.
 * @returns {CharDataArray} An array of data from the FFL_ODB.
 * @throws {Error}
 */
function getCharDataArrayFromDatabase(uint8Array) {
  // Get the database type and create the accessor.
  const db = MiiDatabaseAccessor.getType(uint8Array);
  const database = new MiiDatabaseAccessor(db, uint8Array);

  const nonEmptyNum = database.getNonEmptyNum();
  const dataArray = database.getCharDataAll();
  const characterNames = Array.from({ length: nonEmptyNum });

  const dataSize = db.getDataSize();
  const swapEndian = dataSize === 92 && !db.isLittleEndian();
  for (let i = 0; i < nonEmptyNum; i++) {
    if (swapEndian) { // Perform endian swapping.
      swapEndianVer3MiiData(dataArray[i], /* hasCreator = */ true);
    }
    if (dataSize === 92) { // Specifically convert 3DS/Wii U Mii data to StoreData.
      dataArray[i] = ver3OfficialToStore(new Uint8Array(96), dataArray[i]);
    }
    // Decode UTF-16 name.
    characterNames[i] = nameFromCharData(dataArray[i], dataSize);
  }

  return {
    dataArray,
    characterNames,
    nonEmptyNum
  };
}

/**
 * Display the list of valid Mii Base64 strings in the HTML.
 * @param {CharDataArray} miis - Array of Mii objects containing name,
 * roomIndex, positionInRoom, and Base64 data.
 */
function displayCharDataArray(miis) {
  const ul = document.getElementById('miiList');
  if (!ul) {
    alert('displayMiis: Element with ID "miiList" does not exist.');
    return;
  }
  ul.innerHTML = ''; // Clear any existing content

  for (let i = 0; i < miis.nonEmptyNum; i++) {
    const name = miis.characterNames[i];
    const data = miis.dataArray[i];

    const li = document.createElement('li');
    li.textContent = name + '\n';

    // Encode data to Base64
    const base64Data = bytesToBase64(data);
    // Add Base64 in a code block
    const codeBlock = document.createElement('code');
    codeBlock.textContent = base64Data;
    li.appendChild(codeBlock);

    // Add inner bullet with image
    const innerUl = document.createElement('ul');
    const innerLi = document.createElement('li');
    const imgWidth = 96;
    innerLi.innerHTML = '<img src="https://mii-unsecure.ariankordi.net/miis/image.png?width=' + imgWidth + '&data=' + encodeURIComponent(base64Data) + '" loading="lazy" width="' + imgWidth + '" height="' + imgWidth + '"><br>';
    innerUl.appendChild(innerLi);
    li.appendChild(innerUl);

    ul.appendChild(li);
  }

  // Inform the user if no valid Miis were found
  if (miis.nonEmptyNum <= 0) {
    const notFound = document.createElement('li');
    notFound.textContent = 'No valid Mii data found.';
    ul.appendChild(notFound);
  }
}

/**
 * Handle the file input change event.
 * @param {Event} event - The change event.
 */
function handleFileSelect(event) {
  const target = /** @type {HTMLInputElement} */ (event.target);
  if (!target || !target.files || !target.files[0]) {
    alert('No file selected.');
    return;
  }

  const file = target.files[0];

  const reader = new FileReader();

  reader.onload = function (e) {
    const arrayBuffer = /** @type {FileReader} */ (e.target).result;
    if (!(arrayBuffer instanceof ArrayBuffer)) {
      console.error('handleFileSelect / reader.onload: FileReader.result is not ArrayBuffer.');
      return;
    }

    let storeData;
    try {
      storeData = getCharDataArrayFromDatabase(new Uint8Array(arrayBuffer));
    } catch (e) {
      alert(e);
      throw e;
    }
    displayCharDataArray(storeData);
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
  const blob = evt.data;
  const reader = new FileReader();

  reader.onloadend = function () {
    if (!reader.result) {
      alert('onFFLODBRead: reader.result is null or undefined, failed to read Blob content.');
      return;
    }
    // Convert text content to an ArrayBuffer
    /** Result of the reader, which is expected to be a string. */
    const textData = reader.result;
    if (typeof textData !== 'string') {
      alert('onFFLODBRead / reader.onloadend: FileReader.result type is unexpectedly not string');
      return;
    }
    const bytes = new Uint8Array(textData.split('').map(
      /**
       * @param {string} char - The character as a string.
       * @returns {number} The byte index of the character.
       */
      function (char) {
        return char.charCodeAt(0);
      }));

    let storeData;
    try {
      storeData = getCharDataArrayFromDatabase(bytes);
    } catch (e) {
      alert(e);
      throw e;
    }
    displayCharDataArray(storeData);
  };

  reader.onerror = function () {
    alert('onFFLODBRead / reader.onerror: Could not read Blob.');
  };

  // Read the Blob as text
  reader.readAsBinaryString(blob); // Use binary string to match expected content format
}

// TODO from 2026-05: NWF was probably broken from ES6 conversion

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
  const b64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  window.btoa = function (string) {
    string = String(string);
    let bitmap;
    let a;
    let b;
    let c;
    let result = '';
    let i = 0;
    /** Amount of final padding. */
    const rest = string.length % 3;

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

    // If there's need of padding, replace the last 'A's with equal signs.
    // eslint-disable-next-line unicorn/prefer-string-slice -- for safari 5
    return rest ? result.slice(0, rest - 3) + '==='.substring(rest) : result;
  };
}

// Ensure the DOM is loaded before attaching event listeners
document.addEventListener('DOMContentLoaded', function () {
  const fileInput = document.getElementById('fileInput');
  if (fileInput && fileInput.addEventListener) {
    fileInput.addEventListener('change', handleFileSelect, false);
  } else {
    alert('Could not find element fileInput.');
  }
});

// export { getCharDataArrayFromDatabase };
