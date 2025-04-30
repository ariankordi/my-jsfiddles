// @ts-check

/* eslint indent: ['error', 2] -- Define indent rules. */
/* eslint no-multi-spaces: 'off' -- Allow spaced comments. */

// // ---------------------------------------------------------------------
// //  AES Keys
// // ---------------------------------------------------------------------

/** @enum number */
const KeyType = {
  Production: 0,
  Development: 1,
  Null: 2
};
/**
 * AES keys at "Type 2, slot 0x31" in sjcl's representation.
 * https://www.3dbrew.org/wiki/PSPXI:EncryptDecryptAes#Key_Types
 * @type {Object<KeyType, sjcl.BitArray>}
 */
const AES_CCM_KEYSLOT_0x31_KEYS = {
  /** Production key. */
  [KeyType.Production]: sjcl.codec.hex.toBits('59FC817E6446EA6190347B20E9BDCE52'),
  /** Development key. */
  [KeyType.Development]: sjcl.codec.hex.toBits('12DF92B6FFD438AB291C4FD4D7CE256D'),
  /** Null key (used in Citra). */
  [KeyType.Null]: sjcl.codec.hex.toBits('00000000000000000000000000000000')
};

const AES_CTR_KEY_HEX = '30819F300D06092A864886F70D010101';

/** Reassigned to dev/prod. */
let gAESCCMKeyPrimary = AES_CCM_KEYSLOT_0x31_KEYS[KeyType.Production];

// @ts-ignore - HACK because jsfiddle blocks this word???
const crpyto = globalThis['crypt' + 'o'];
/**
 * Shortcut to SubtleCr*pto.
 * @todo NOTE: You may have to change this in your own setup.
 */
const sc = crpyto.subtle;
// ^^ Needed or else the fiddle will not save

/** Determines if the StoreData will be modified before making a QR code ({@link modifyStoreDataCopyablePlatform}) */
let gModifyStoreDataForQr = true;

// // ---------------------------------------------------------------------
// //  Constants
// // ---------------------------------------------------------------------

/** Size of encrypted Mii data found in QR codes (CFLiWrappedMiiData, FFLiWrappedStoreData) */
const WRAPPED_MII_DATA_LENGTH = 112; // 0x70

/** Size of 3DS/Wii U format Mii data, referred to as: FFLStoreData, CFLiMiiDataPacket, nn::mii::Ver3StoreData */
const VER3_STORE_DATA_LENGTH = 96; // 0x60
/** Minimum size for 3DS/Wii U Mii data (CFLiPackedMiiDataCore, FFLiMiiDataCore) */
const MII_DATA_CORE_LENGTH = 72;

/** Size of the AES-CCM nonce (IV) within wrapped data. */
const WRAPPED_NONCE_LENGTH = 12;
/** Size of the AES-CCM tag (MAC) within wrapped data. */
const WRAPPED_TAG_LENGTH = 16;
/** Offset of the ID in StoreData used for wrapped data (CreateID) */
const WRAPPED_ID_OFFSET = 12;
/**
 * Size of the ID in the wrapped data that forms the nonce.
 * While this ID is taken from CreateID, it is truncated to be
 * two bytes smaller because it has to be a multiple of 4,
 * and less than/equal to the nonce size, so it couldn't be 16.
 * @type {number}
 */
const WRAPPED_ID_LENGTH = 8; // (10) & ~3

/** Length of an IV for AES-CTR used in {@link encryptAesCtr}. */
const AES_IV_LENGTH = 16;
const AES_IV_LENGTH_BITS = AES_IV_LENGTH * 8; // 128

/** Test StoreData. */
const jasmineStoreData = 'AwAAQKBBOMSghAAA27iHMb5gKyoqQgAAWS1KAGEAcwBtAGkAbgBlAAAAAAAAABw3EhB7ASFuQxwNZMcYAAgegg0AMEGzW4JtAABvAHMAaQBnAG8AbgBhAGwAAAAAAJA6';

// // ---------------------------------------------------------------------
// //  Utility Conversion
// // ---------------------------------------------------------------------

/**
 * Hex -> U8 / https://gist.github.com/themikefuller/608202bde24077990c0539f960b79fe4 (hex2string)
 * @param {string} hex - Input hex data to decode.
 * @returns {Uint8Array} Decoded input data.
 */
const hexToBytes = hex => new Uint8Array((hex.match(/.{1,2}/g) || [])
  .map((/** @type {string} */ byte) => parseInt(byte, 16)));
/**
 * U8 -> Hex / https://www.xaymar.com/articles/2020/12/08/fastest-uint8array-to-hex-string-conversion-in-javascript/
 * @param {Array<number>|Uint8Array} bytes - Input data to encode.
 * @returns {string} Hexadecimal representation of `buffer`.
 */
const bytesToHex = bytes => Array.prototype.map.call(bytes,
  (/** @type {{ toString: (arg0: number) => string; }} */ x) => x.toString(16).padStart(2, '0')).join('');

/**
 * Converts Uint8Array to hex with spaces between every byte.
 * @param {Array<number>|Uint8Array} bytes - Input data to encode.
 * @returns {string} Hexadecimal representation of `buffer` with spaces between every byte.
 */
const bytesToHexSpaced = bytes => bytesToHex(bytes).replace(/(.{2})/g, '$1 ');

/**
 * Base64 -> U8 / https://stackoverflow.com/a/41106346
 * @param {string} base64 - Input Base64 data to decode.
 * @returns {Uint8Array} Decoded input data.
 */
const base64ToBytes = base64 => Uint8Array.from(atob(base64), c => c.charCodeAt(0));

/**
 * @param {string} str - Input string to check.
 * @returns {boolean} Whether the string is valid hex.
 */
function isHex(str) {
  const hexRegex = /^[0-9A-Fa-f]+$/;
  return hexRegex.test(str);
}

/**
 * @param {string} str - Input string to check.
 * @returns {boolean} Whether the string is valid Base64.
 */
function isBase64(str) {
  try {
    atob(str); // `atob` will throw an error if the string is not valid base64
    return true;
  } catch {
    return false;
  }
}

// // ---------------------------------------------------------------------
// //  CRC-16 and CRC-32
// // ---------------------------------------------------------------------

/** Polynomial for CRC-16/CCITT. */
// const CRC16_CCITT_POLY = 0x1021;

/** Polynomial for CRC-32/POSIX/CKSUM. */
const CRC32_CKSUM_POLY = 0x04C11DB7;

/**
 * Calculates the CRC-16/CCITT/XMODEM checksum for the specified input data.
 * Courtesy of Luciano Barcaro: https://stackoverflow.com/a/30357446
 * @param {Uint8Array|Array<number>} data - The data to create a checksum of.
 * @param {number} [current] - The starting CRC value, defaulting to 0.
 * @returns {number} The calculated CRC-16 checksum.
 */
function crc16(data, current = 0x0000) {
  const crc = current;
  let msb = crc >> 8;
  let lsb = crc & 0xFF;

  for (let i = 0; i < data.length; i++) {
    const c = data[i];
    let x = c ^ msb;
    x ^= (x >> 4);
    msb = (lsb ^ (x >> 3) ^ (x << 4)) & 0xFF;
    lsb = (x ^ (x << 5)) & 0xFF;
  }

  return (msb << 8) | lsb;
}

/** Table for CRC-32 lookup. */
const crc32CksumTable = new Uint32Array(256);

/**
 * Function to generate a CRC-32/POSIX/CKSUM table.
 * @param {Uint32Array} table - The Uint32Array to populate with the table.
 * @param {number} [poly] - The polynomial to generate the CRC-32 table with.
 */
function generateCrc32Table(table, poly = CRC32_CKSUM_POLY) {
  for (let i = 0; i < 256; i++) {
    let crc = i << 24;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x80000000) {
        crc = (crc << 1) ^ poly;
      } else {
        crc = crc << 1;
      }
    }
    table[i] = crc >>> 0; // Ensure the value is an unsigned 32-bit integer
  }
}

generateCrc32Table(crc32CksumTable); // Generate the table.

/**
 * Calculates a checksum of `data` using CRC-32/POSIX/CKSUM.
 * @param {Uint8Array|Array<number>} input - The data to create a checksum of.
 * @param {Uint32Array} [table] - The CRC-32 table to use.
 * @returns {number} The CRC-32 checksum.
 */
function crc32(input, table = crc32CksumTable) {
  let crc = 0x00000000;
  for (let i = 0; i < input.length; i++) {
    const byte = (input[i] ^ (crc >>> 24)) & 0xFF;
    crc = (table[byte] ^ (crc << 8)) >>> 0;
  }
  // XOR with 0xFFFFFFFF at the end and ensure it's unsigned
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/**
 * Updates the CRC-16 checksum in StoreData.
 * @param {Uint8Array} storeData - The data to update the checksum for.
 */
function updateStoreDataCRC(storeData) {
  // Update the CRC-16 in the data.
  const crcOffset = VER3_STORE_DATA_LENGTH - 2;
  const crc = crc16(storeData.subarray(0, crcOffset));
  // Store as big-endian.
  new DataView(storeData.buffer).setUint16(crcOffset, crc, false);
}

/**
 * Modifies the StoreData to set birthPlatform to 3,
 * enabling it to be scannable on a 3DS, and enable copying.
 * @param {Uint8Array} storeData - The Mii StoreData to modify.
 */
function modifyStoreDataCopyablePlatform(storeData) {
  // Mii data created on Wii U, Miitomo, and Switch
  // have birthPlatform set to 4 (= Wii U). That data is
  // not scannable as a QR code on 3DS because it will
  // fail verification if birthPlatform > 3.
  // Set birthPlatform bitfield to 3 (CFLi_BIRTH_PLATFORM_CTR)
  storeData[3] = storeData[3] & 0b10001111 | 0b00110000;
  // Allow the Mii to be copied, for convenience.
  storeData[1] |= 1; // copyable = 1
}

// // ---------------------------------------------------------------------
// //  AES-CCM Encryption
// // ---------------------------------------------------------------------

/**
 * The sjcl.mode.ccm._ctrMode private function.
 * Originally defined here:  https://github.com/bitwiseshiftleft/sjcl/blob/85caa53c281eeeb502310013312c775d35fe0867/core/ccm.js#L194
 * @typedef {(
 * prf: { encrypt: (input: sjcl.BitArray) => sjcl.BitArray },
 * data: sjcl.BitArray, iv: sjcl.BitArray,
 * tag: sjcl.BitArray, tlen: number, L: number
 * ) => { data: sjcl.BitArray, tag: sjcl.BitArray }} _ctrMode
 */

/**
 * Gets the private {@link _ctrMode} function in SJCL.
 * This private function's name is minified across builds.
 * @returns {_ctrMode} The sjcl.mode.ccm._ctrMode private function
 * that decrypts AES-CCM ciphertext without verifying the tag.
 * @throws {Error} Throws if the function cannot be found.
 */
function getSjclCcmCtrModeDecryptFunc() {
  // NOTE: If you are adapting this code, you may find the
  // minified version of the function yourself, and return it here.
  // Example ("sjcl-with-all" v1.0.8 from npm):
  // return sjcl.mode.ccm.u;

  /** regex to find the _ctrMode function: 6 arguments and calls "bitSlice" */
  const ctrModeFuncRegex = /\([^)]*,[^)]*,[^)]*,[^)]*,[^)]*,[^)]*\)\s*.*?bitSlice/;
  /**
   * Closure to find the _ctrMode function by matching its string representation.
   * @param {[string, Function]} entry - A [key, function] pair from Object.entries.
   * @returns {Array<string>|null} Match if function signature matches ctrMode.
   */
  // eslint-disable-next-line no-unused-vars -- key is not needed
  const ctrModeFuncMatch = ([_, fn]) => fn.toString().match(ctrModeFuncRegex);

  /** sjcl.mode.ccm object/namespace. */
  const ccm = /** @type {Object<string, *>} */ (sjcl.mode.ccm);
  /**
   * jsdelivr (1.0.8 sjcl.min.js) minifies this function name to "C"
   * @type {_ctrMode}
   */
  let ctrDecrypt = /** @type {_ctrMode} */ (ccm._ctrMode) || /** @type {_ctrMode} */ (ccm.C);
  if (!ctrDecrypt) {
    // Use the pattern to find the private _ctrMode function.
    const match = Object.entries(sjcl.mode.ccm).find(ctrModeFuncMatch);
    // Validate that the match turned up a function.
    if (Array.isArray(match) && match.length > 0 && typeof match[1] === 'function') {
      ctrDecrypt = match[1]; // Assign the function.
    } else {
      throw new Error('Private sjcl.mode.ccm._ctrMode function cannot be found. The build of sjcl expected may have changed. Cannot continue with decryption.');
    }
  }

  return ctrDecrypt;
}

/**
 * Gets 96 byte 3DS/Wii U format Mii data from QR code data.
 * Decrypts the AES-CCM encrypted data (CFLiWrappedMiiData) from the QR code using sjcl.
 *
 * References (Credits: 3DBrew contributors, jaames, kazuki-4ys):
 * - https://www.3dbrew.org/wiki/Mii_Maker#Mii_QR_Code_format
 * - https://gist.github.com/jaames/96ce8daa11b61b758b6b0227b55f9f78
 * - https://github.com/kazuki-4ys/kazuki-4ys.github.io/blob/148dc339974f8b7515bfdc1395ec1fc9becb68ab/web_apps/MiiInfoEditorCTR/encode.js#L57
 * - CFL: void CFLi_UnwrapMiiData(CFLiMiiDataPacket* packetData, CFLiWrappedMiiData* wrappedData);
 * -> nn::applet::CTR::detail::Unwrap(packetData, wrappedData, 0x70, 0xc, 10);
 * -> nn::ps::UnwrapMii(void* pMiiBuffer, const void* pWrapped, size_t wrappedSize, s32 idOffset, size_t idSize);
 * (> ctr.7z: ctr/sources/libraries/ps/CTR/ps_Util.cpp)
 * - FFL: FFLResult FFLiUnwrapStoreData(FFLiStoreDataCFL*, const FFLiWrappedStoreData*);
 * -> ACPMiiUnwrap(pStoreDataCFL, FFL_MIIDATA_PACKET_SIZE, pWrappedStoreData, FFLI_WRAPPEDSTOREDATA_SIZE);
 *
 * The default AES-CCM decryption function in sjcl fails to verify the tag (MAC)
 * due to the following errata: https://www.3dbrew.org/wiki/AES_Registers#CCM_mode_pitfall
 * In order to skip verification of the tag (MAC), a private function to
 * decrypt without verifying is used, obtained by {@link getSjclCcmCtrModeDecryptFunc}.
 * @param {Uint8Array} dst - Destination to write the decrypted StoreData to.
 * Expected size is {@link VER3_STORE_DATA_LENGTH}.
 * @param {Uint8Array} encryptedData - Encrypted "wrapped" Mii QR code data (CFLiWrappedMiiData)
 * @param {Array<number>} [key] - The key to pass into sjcl.
 * @returns {void}
 * @throws {Error} Throws if the input data's size doesn't match {@link WRAPPED_MII_DATA_LENGTH}.
 */
function decryptAesCcm(dst, encryptedData, key = gAESCCMKeyPrimary) {
  // key = [1509720446, 1682369121, -1875608800, -373436846]) {

  if (encryptedData.length < WRAPPED_MII_DATA_LENGTH) { // Verify length.
    throw new Error(`decryptAesCcm: Input size is ${encryptedData.length}, expected ${WRAPPED_MII_DATA_LENGTH} or longer.`);
  }

  /** AES-CCM nonce (like an IV) initialized to zeroes. */
  const nonce = new Uint8Array(WRAPPED_NONCE_LENGTH);
  nonce.set(encryptedData.subarray(0, WRAPPED_ID_LENGTH)); // Extract the ID into the nonce.
  /** Extracted ciphertext. */
  const encryptedContent = encryptedData.subarray(WRAPPED_ID_LENGTH);

  // Convert encrypted content and nonce to sjcl.BitArray (toBits expects array).
  // @ts-ignore -- Works with Uint8Array.
  const encryptedBits = sjcl.codec.bytes.toBits(encryptedContent);
  /** Nonce padded to 12 bytes. */
  // @ts-ignore -- Works with Uint8Array.
  const nonceBits = sjcl.codec.bytes.toBits(nonce);

  // Isolate the actual ciphertext from the tag and adjust IV.
  // Copied from sjcl.mode.ccm.decrypt: https://github.com/bitwiseshiftleft/sjcl/blob/85caa53c281eeeb502310013312c775d35fe0867/core/ccm.js#L83
  /** Tag length in bits. */
  const tlen = WRAPPED_TAG_LENGTH * 8;
  const dataWithoutTag = sjcl.bitArray.clamp(encryptedBits,
    // remove tag from out, tag length = 128
    sjcl.bitArray.bitLength(encryptedBits) - tlen);

  // Get the decrypt function.
  const ctrDecrypt = getSjclCcmCtrModeDecryptFunc();

  /** New sjcl AES cipher constructed using the key. */
  const cipher = new sjcl.cipher.aes(key);

  const decryptedBits = ctrDecrypt(cipher, dataWithoutTag,
    // hardcoding 3 as "L" / length
    nonceBits, [], tlen, 3);
  // NOTE: The tag (CBC-MAC) within the encrypted data is NOT verified here.

  // Convert the decrypted bytes from sjcl.BitArray format.
  const decryptedArray = sjcl.codec.bytes.fromBits(decryptedBits.data);
  // Create a Uint8Array so that we can slice and copy from it.
  const decryptedBytes = new Uint8Array(decryptedArray)
    .subarray(0, encryptedData.length - WRAPPED_ID_LENGTH);

  // Create the final Mii StoreData from the decrypted bytes.
  // const dst = new Uint8Array(encryptedData.length);
  dst.set(decryptedBytes.subarray(0, WRAPPED_NONCE_LENGTH)); // First 12 decrypted bytes.
  dst.set(nonce, WRAPPED_NONCE_LENGTH); // Original nonce from the encrypted bytes.
  // Copy the rest of the decrypted bytes.
  dst.set(decryptedBytes.subarray(WRAPPED_NONCE_LENGTH),
    WRAPPED_NONCE_LENGTH + WRAPPED_ID_LENGTH);
}

/**
 * Encrypts 3DS/Wii U Mii data with AES-CCM (CFLiWrappedMiiData)
 * using sjcl for use in a Mii QR code.
 *
 * References (Credits: 3DBrew contributors, jaames, kazuki-4ys):
 * - https://www.3dbrew.org/wiki/Mii_Maker#Mii_QR_Code_format
 * - (Only decryption) https://gist.github.com/jaames/96ce8daa11b61b758b6b0227b55f9f78
 * - https://github.com/kazuki-4ys/kazuki-4ys.github.io/blob/148dc339974f8b7515bfdc1395ec1fc9becb68ab/web_apps/MiiInfoEditorCTR/encode.js#L46
 * - CFL: void CFLi_WrapMiiData(CFLiWrappedMiiData* wrappedData, CFLiMiiDataPacket* packetData);
 * -> nn::applet::CTR::detail::Wrap(wrappedData,packetData, 0x60, 0xc, 10);
 * -> nn::ps::WrapMii(void* pWrappedBuffer, const void* pMii, size_t miiSize, s32 idOffset, size_t idSize);
 * (> ctr.7z: ctr/sources/libraries/ps/CTR/ps_Util.cpp)
 * - FFL: FFLResult FFLiWrapStoreData(FFLiWrappedStoreData*, const FFLiStoreDataCFL*);
 * -> ACPMiiWrap(pWrappedStoreData, FFLI_WRAPPEDSTOREDATA_SIZE, pWrappedStoreData, FFL_MIIDATA_PACKET_SIZE);
 * @param {Uint8Array} dst - Destination to write the
 * encrypted QR code data (CFLiWrappedMiiData) to. Expected size is {@link WRAPPED_MII_DATA_LENGTH}.
 * @param {Uint8Array} storeData - Input 96 byte StoreData to encrypt.
 * @param {Array<number>} [key] - The key to pass into sjcl.
 * @returns {void}
 * @throws {Error} Throws if the input data's size doesn't match {@link VER3_STORE_DATA_LENGTH}.
 */
function encryptAesCcm(dst, storeData, key = gAESCCMKeyPrimary) {
  if (storeData.length !== VER3_STORE_DATA_LENGTH) { // Verify length.
    throw new Error(`encryptAesCcm: Input size is ${storeData.length}, expected ${VER3_STORE_DATA_LENGTH} / 3DS/Wii U format Mii StoreData.`);
  }

  /** Offset after the ID ends. */
  const idEndOffset = WRAPPED_ID_OFFSET + WRAPPED_ID_LENGTH;
  /** The ID to include in the encrypted data as the nonce (IV). */
  const wrappedID = storeData.subarray(WRAPPED_ID_OFFSET, idEndOffset);

  /** The content to be encrypted. Consists of the data with the ID cut out, and with extra padding. */
  const content = new Uint8Array(
    // Size: 96-len(id) (= 88) + len(id) = 96
    VER3_STORE_DATA_LENGTH);
  content.set(storeData.subarray(0, WRAPPED_ID_OFFSET)); // Copy until the ID.
  content.set(storeData.subarray(idEndOffset), WRAPPED_ID_OFFSET); // Copy after the ID.
  // This leaves 8 bytes of padding.

  /** AES-CCM nonce (like an IV) initialized to zeroes. */
  const nonce = new Uint8Array(WRAPPED_NONCE_LENGTH);
  nonce.set(wrappedID); // Set the ID in the nonce, leaving extra padding.
  // @ts-ignore -- Works with Uint8Array.
  const nonceBits = sjcl.codec.bytes.toBits(nonce);
  // @ts-ignore -- Works with Uint8Array.
  const contentBits = sjcl.codec.bytes.toBits(content);

  /** New sjcl AES cipher constructed using the key. */
  const cipher = new sjcl.cipher.aes(key);

  const tlen = WRAPPED_TAG_LENGTH * 8;
  // Encrypt the padded StoreData with the ID cut out, using the ID as a nonce (IV).
  const encryptedBits = sjcl.mode.ccm.encrypt(cipher, contentBits, nonceBits, undefined, tlen);
  const encryptedBytes = new Uint8Array(sjcl.codec.bytes.fromBits(encryptedBits));

  // The encrypted bytes are padded and the tag is at the end.
  const correctEncryptedContentLength =
    encryptedBytes.length - WRAPPED_ID_LENGTH - WRAPPED_TAG_LENGTH;
  // The data is spliced to remove the extra padding in the middle.
  const encryptedContentCorrected = encryptedBytes.subarray(0, correctEncryptedContentLength);
  const tag = encryptedBytes.subarray(encryptedBytes.length - WRAPPED_TAG_LENGTH);

  // const dst = new Uint8Array(WRAPPED_MII_DATA_LENGTH);
  dst.set(wrappedID); // Set nonce from the original data.
  dst.set(encryptedContentCorrected, WRAPPED_ID_LENGTH); // Encrypted content.
  dst.set(tag, VER3_STORE_DATA_LENGTH); // Set tag after content + nonce.
}

/**
 * @param {Uint8Array} a - First buffer to compare.
 * @param {Uint8Array} b - Second buffer to compare.
 * @returns {boolean} Whether the buffers' content matches.
 */
function uint8ArrayCmp(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

/** Tests {@link encryptAesCcm} against known good data. */
function encryptAesCcmTest() {
  const WRAP_TEST_DATA = new Uint8Array([
    0x03, 0x00, 0x00, 0x30, 0xdf, 0x9a, 0x34, 0x02,
    0x83, 0xa5, 0xea, 0xbd, 0x90, 0xf1, 0x07, 0xdc,
    0x78, 0xa2, 0xa0, 0x35, 0xd8, 0xa4, 0x00, 0x00,
    0x01, 0x00, 0x51, 0x30, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x40, 0x40,
    0x00, 0x00, 0x0c, 0x01, 0x04, 0x68, 0x43, 0x18,
    0x20, 0x34, 0x46, 0x14, 0x81, 0x12, 0x17, 0x68,
    0x0d, 0x00, 0x00, 0x29, 0x00, 0x52, 0x48, 0x50,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x41, 0xc8
  ]);

  const WRAP_EXPECTED = new Uint8Array([
    0x90, 0xf1, 0x07, 0xdc, 0x78, 0xa2, 0xa0, 0x35,
    0xff, 0xc5, 0x59, 0x1c, 0x2f, 0x33, 0xc0, 0x12,
    0x05, 0x8b, 0x34, 0x56, 0xb8, 0xb9, 0xa4, 0x71,
    0x71, 0x6d, 0x38, 0xa1, 0x06, 0x7a, 0x14, 0x91,
    0x23, 0x17, 0x84, 0xb6, 0x52, 0x05, 0xa9, 0xff,
    0xa9, 0x28, 0x15, 0x3b, 0x6b, 0xa8, 0x9c, 0x8b,
    0xa3, 0xff, 0xb3, 0x3b, 0x75, 0x0b, 0xc9, 0x03,
    0xea, 0x25, 0x63, 0xa4, 0xe4, 0x0e, 0x57, 0xa8,
    0xa1, 0xdd, 0xd2, 0x34, 0xc2, 0xd6, 0x67, 0x1b,
    0x85, 0x1a, 0xd0, 0x19, 0x2f, 0xc4, 0x79, 0xd5,
    0xbb, 0x79, 0xfa, 0x45, 0xe2, 0x0c, 0x01, 0xea,
    0x9a, 0x44, 0x36, 0x29, 0xf3, 0xcb, 0x18, 0xa3,
    0xf8, 0x11, 0xf8, 0x8e, 0xbe, 0x5f, 0x19, 0x26,
    0xa2, 0x67, 0xb1, 0x97, 0xf0, 0x7a, 0x0d, 0xa7
  ]);

  /**
   * @param {Uint8Array} a - First buffer to compare.
   * @param {Uint8Array} b - Second buffer to compare.
   */
  function onMismatch(a, b) {
    console.error('mismatch:', a, b);
    console.info('mismatch hex:', bytesToHex(a), bytesToHex(b));
  }
  // Expected test data is using dev key.
  const key = AES_CCM_KEYSLOT_0x31_KEYS[Number(KeyType.Development)];

  // encode test
  const wrapped = new Uint8Array(WRAPPED_MII_DATA_LENGTH);
  encryptAesCcm(wrapped, WRAP_TEST_DATA, key);

  if (!uint8ArrayCmp(WRAP_EXPECTED, wrapped)) {
    onMismatch(WRAP_EXPECTED, wrapped);
    return;
  }

  // decode test
  const storeData = new Uint8Array(VER3_STORE_DATA_LENGTH);
  decryptAesCcm(storeData, wrapped, key);
  if (!uint8ArrayCmp(WRAP_TEST_DATA, storeData)) {
    onMismatch(WRAP_TEST_DATA, storeData);
    return;
  }
  console.info('encryptAesCcmTest: ✅ passed (en/de)code');
}

encryptAesCcmTest();

// // ---------------------------------------------------------------------
// //  AES-CTR Encryption
// // ---------------------------------------------------------------------

/**
 * Decrypts AES-CTR-128.
 * @param {Uint8Array} encryptedData - The encrypted data.
 * @param {Uint8Array} iv - The IV for the data.
 * @param {Uint8Array} [keyData] - The key for the data.
 * @returns {Promise<Uint8Array>} The decrypted data.
 */
async function decryptAesCtr(encryptedData, iv, keyData = hexToBytes(AES_CTR_KEY_HEX)) {
  // Calls to SubtleCr*pto (window.cr*pto.subtle):
  const key = await sc.importKey('raw', keyData, { name: 'AES-CTR' }, false, ['decrypt']);
  const decrypted = await sc.decrypt(
    { name: 'AES-CTR', counter: iv, length: AES_IV_LENGTH_BITS }, key, encryptedData);
  return new Uint8Array(decrypted);
}

/**
 * Encrypts AES-CTR-128.
 * @param {Uint8Array} data - The input data.
 * @param {Uint8Array} [keyData] - The key for the data.
 * @returns {Promise<{encryptedData: Uint8Array, iv: Uint8Array}>} The encrypted data and new IV.
 */
async function encryptAesCtr(data, keyData = hexToBytes(AES_CTR_KEY_HEX)) {
  // Calls to SubtleCr*pto (window.cr*pto.subtle):
  const key = await sc.importKey('raw', keyData, { name: 'AES-CTR' }, false, ['encrypt']);
  // window.cr*pto.getRandomValues:
  const iv = crpyto.getRandomValues(new Uint8Array(AES_IV_LENGTH));

  const encrypted = await sc.encrypt({ name: 'AES-CTR', counter: iv, length: AES_IV_LENGTH_BITS }, key, data);
  return { encryptedData: new Uint8Array(encrypted), iv };
}

// // ---------------------------------------------------------------------
// //  QR Code Creation and Scanning
// // ---------------------------------------------------------------------

// These functions are meant to be used completely inline within
// the sample and weren't written to be reused at all...

const qrCodeContainer = /** @type {HTMLDivElement} */ (document.getElementById('qr-code-container'));

/**
 * Generates a QR code of the data using {@link encryptAesCcm} and {@link encryptAesCtr}.
 * @param {Uint8Array} [storeData] - Input StoreData.
 * @param {Uint8Array} [extraData] - Input extra data.
 * @returns {Promise<void>} The code is emitted to HTML ID "qr-code-container".
 * @throws {Error} Throws if "qr-code-container" element does not exist, or StoreData is empty.
 */
async function generateQrCode(storeData = hexEditorBaseInput.saveToArray(),
  extraData = hexEditorExtraInput.saveToArray()) {
  if (storeData.length < 1) {
    alert(`Please upload or enter Mii StoreData.
If you don't have any, try pasting this: ${jasmineStoreData}`);
    return;
  }

  if (gModifyStoreDataForQr) {
    // Modify the data to allow copying and scanning on 3DS.
    modifyStoreDataCopyablePlatform(storeData);
    // Update the CRC-16 in the data.
    updateStoreDataCRC(storeData);
  }

  /** The additional length used by extra data in the QR code. */
  const extraDataAddLength = (extraData.length > 0)
    ? extraData.length + 4 + AES_IV_LENGTH // Add CRC-32 and IV.
    : 0;
  // Create buffer to store encrypted data and extra data.
  const encryptedBytes = new Uint8Array(WRAPPED_MII_DATA_LENGTH + extraDataAddLength);

  // Create encrypted/"wrapped" data to put in the QR code.
  encryptAesCcm(encryptedBytes, storeData);

  console.debug('qr data (WrappedMiiData):', bytesToHexSpaced(encryptedBytes));
  if (extraData.length > 0) {
    // Append extra data if present.
    await appendExtraToQrData(encryptedBytes, extraData);
  }
  console.debug('final encrypted qr data', encryptedBytes);

  if (!qrCodeContainer || !(qrCodeContainer.firstElementChild instanceof HTMLImageElement)) {
    throw new Error('generateQrCode: Element qr-code-container or its child is not an image.');
  }

  // 112 byte WrappedMiiData QR codes are version 10 and have high error correction.

  /** @type {HTMLImageElement} */ (qrCodeContainer.firstElementChild).src =
    // Matches the original QR code images 1:1.
    // QRCode.generatePNG(encryptedBytes, { margin: 0, modulesize: 2, ecclevel: 'H' });
    QRCode.generatePNG(encryptedBytes, { margin: null, ecclevel: 'H' });
}

/**
 * Appends extra data before AES-CTR encryption and CRC-32
 * to the wrapped StoreData for use in a QR code.
 * @param {Uint8Array} encryptedBytes - The wrapped StoreData, which the extra data
 * will be appended at the end of.
 * @param {Uint8Array} extraData - The extra data.
 */
async function appendExtraToQrData(encryptedBytes, extraData) {
  // Append extra data and CRC-32, which needs to account for WrappedMiiData.
  encryptedBytes.set(extraData, WRAPPED_MII_DATA_LENGTH); // Append decrypted extra data.

  // Calculate CRC-32 checksum based on encrypted StoreData + decrypted extra data.
  const dataForCrc = encryptedBytes.subarray(0, WRAPPED_MII_DATA_LENGTH + extraData.length);
  // console.debug('data into crc32:', bytesToHexSpaced(dataForCrc));
  const crc = crc32(dataForCrc);
  // const crcBytes = [crc & 0xff, (crc >> 8) & 0xff, (crc >> 16) & 0xff, (crc >> 24) & 0xff];
  // console.debug('crc32: ', bytesToHexSpaced(crcBytes));

  /** Extra data with CRC appended at the end. */
  const extraWithCrc = new Uint8Array(extraData.length + 4);
  extraWithCrc.set(extraData);// WRAPPED_MII_DATA_LENGTH);
  // Write CRC-32 as an unsigned 32-bit little-endian integer.
  // const totalOffsetCrc = WRAPPED_MII_DATA_LENGTH + extraData.length + 4;
  // new DataView(encryptedBytes.buffer).setUint32(totalOffsetCrc, crc, true);
  new DataView(extraWithCrc.buffer).setUint32(extraData.length, crc, true);
  // const extraWithCrc = encryptedBytes.subarray(WRAPPED_MII_DATA_LENGTH, extraData.length + 4);

  // Get randomly generated IV and ciphertext as a new buffer.
  const { encryptedData: encryptedExtra, iv } = await encryptAesCtr(extraWithCrc);

  // Copy the IV first, then the encrypted data, after the main QR data.
  encryptedBytes.set(iv, WRAPPED_MII_DATA_LENGTH);
  encryptedBytes.set(encryptedExtra, WRAPPED_MII_DATA_LENGTH + AES_IV_LENGTH);
  // qrData = new Uint8Array([...qrData, ...iv, ...encryptedExtra]);
}

const extraDataWarning = /** @type {HTMLElement} */ (document.getElementById('extra-data-warning'));
const extraDataWarningInner = /** @type {HTMLElement} */ (document.getElementById('extra-data-warning-inner'));

/** @typedef {{bytes: Array<number>}} QrScannerResult */
/**
 * The callback for the scanned QR code data from QrScanner.
 * @param {QrScannerResult} result - The result object received from QrScanner.
 * @throws {Error} Throws if scanned length is 0.
 */
async function handleQrCode(result) {
  if (!result || !result.bytes) {
    return;
  }

  // Stop the scanner if the result is good.
  cameraScanner.stop();

  if (!result.bytes.length) { // Length is falsy.
    throw new Error(`handleQrCode: Scanned QR code data has byte length of ${result.bytes.length}.`);
  }
  // Scan was successful.
  extraDataWarning.style.display = 'none'; // Reset the warning.

  const encryptedBytes = new Uint8Array(result.bytes);

  /** Decodes StoreData in the QR code and displays it in the hex editor. */
  function decodeStoreData() {
    const decryptedData = new Uint8Array(VER3_STORE_DATA_LENGTH);
    /** Decrypt the first AES-CCM encrypted portion. */
    decryptAesCcm(decryptedData, encryptedBytes.subarray(0, WRAPPED_MII_DATA_LENGTH));

    hexEditorBaseOutput.loadFromArray(decryptedData);
  }

  decodeStoreData();

  /** Decodes extra data in the QR code (must be present) and displays in the hex editor. */
  async function decodeExtraData() {
    const ivOffset = WRAPPED_MII_DATA_LENGTH + 16;
    /** Take the 128 bit IV. */
    const iv = encryptedBytes.subarray(WRAPPED_MII_DATA_LENGTH, ivOffset);
    /** This is the full ciphertext. Last 4 bytes are the CRC-32. */
    const encryptedExtra = encryptedBytes.subarray(ivOffset);
    try {
      const decryptedExtra = await decryptAesCtr(encryptedExtra, iv);
      // If decryption succeeded, slice off the CRC-32 in the data and load that.
      const decryptedExtraData = decryptedExtra.subarray(0, -4);

      const crcOffset = decryptedExtra.length - 4;
      /** Actual CRC-32 in the data. */
      const crcActual = new DataView(decryptedExtra.buffer).getUint32(crcOffset, true);

      // Verify the CRC-32 checksum, which verifies against the
      // encrypted (wrapped) StoreData with the decrypted extra data.

      // Copy encryptedBytes array and set decrypted extra data within it.
      const encryptedForCrc = new Uint8Array(encryptedBytes);
      encryptedForCrc.set(decryptedExtraData, WRAPPED_MII_DATA_LENGTH);
      const offsetForCrc = WRAPPED_MII_DATA_LENGTH + decryptedExtraData.length;
      const dataForCrc = encryptedForCrc.subarray(0, offsetForCrc);
      /** Calculated CRC-32 from the real data. */
      const crcExpected = crc32(dataForCrc);
      if (crcExpected !== crcActual) {
      // Throw if comparison failed. Effectively load un-CRC'd data.
        throw new Error('CRC-32 checksum in extra data does not match. Loading data as-is without decryption.');
      }
      // CRC matches, load into output.
      hexEditorExtraOutput.loadFromArray(decryptedExtraData);
    } catch (error) {
      console.error(error);
      extraDataWarning.style.display = 'initial';
      extraDataWarningInner.textContent = error;
      /** Extra data without decryption. */
      const extra = encryptedBytes.subarray(WRAPPED_MII_DATA_LENGTH);
      hexEditorExtraOutput.loadFromArray(extra);
    } finally {
    // In all cases, display output.
      hexEditorExtraOutput.container.style.display = 'initial';
    }
  }

  // Assume that encrypted extra data is present if
  // the encrypted data is larger than 112 bytes.
  if (encryptedBytes.length > WRAPPED_MII_DATA_LENGTH) {
    await decodeExtraData();
  } else {
    hexEditorExtraOutput.container.style.display = 'none';
  }
}

// // ---------------------------------------------------------------------
// //  Utilities used when downloading data
// // ---------------------------------------------------------------------

/**
 * @param {Uint8Array} data - The data from which to extract the string.
 * @param {number} startOffset - The offset at which to get the text.
 * @param {number} [byteLength] - The length of the string in bytes.
 * @returns {string} The extracted string.
 */
function extractUTF16LEText(data, startOffset, byteLength = 20) {
  let endPosition = startOffset;

  // Determine the byte order based on the isBigEndian flag
  const decoder = new TextDecoder('utf-16le');

  // Find the position of the null terminator (0x00 0x00)
  while (endPosition < startOffset + byteLength) {
    if (data[endPosition] === 0x00 && data[endPosition + 1] === 0x00) {
      break;
    }
    endPosition += 2; // Move in 2-byte increments (UTF-16)
  }

  // Extract and decode the name bytes
  const nameBytes = data.subarray(startOffset, endPosition);
  return decoder.decode(nameBytes);
}

/**
 * @param {Uint8Array} data - The Ver3StoreData data.
 * @returns {string} The name from the data.
 */
const getNameFromStoreData = data => extractUTF16LEText(data, 0x1A);

/**
 * @param {number} length - The length of the extra data.
 * @returns {string} A generic name that can be used in a filename to describe the extra data.
 */
function getExtraDataGenericName(length) {
  switch (length) {
    case 40:
      return 'miitomo-data';
    case 240:
      return 'tomodachi-life-data';
    case 192:
      return 'miitopia-data';
    default:
      return 'data';
  }
}

/** @returns {string} The current time in a format that can be included in a file name. */
function getFormattedTime() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
}

// // ---------------------------------------------------------------------
// //  Helpers for Downloading Data
// // ---------------------------------------------------------------------

/**
 * General function to download any data as a file.
 * It will create a blob of the data, then make an anchor
 * element with the blob link and click on it.
 * @param {Uint8Array} data - The data to download.
 * @param {string} filename - The filename that the file should appear with.
 * @param {string} [mimeType] - The MIME type for the file to download.
 */
function downloadData(data, filename, mimeType = 'application/octet-stream') {
  if (data.length < 1) {
    return; // ignore blank data
  }
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url); // Clean up the object URL
}

/**
 * Function to download StoreData using {@link downloadData}.
 * @param {Uint8Array} [data] - The StoreData to download.
 */
function downloadStoreData(data = hexEditorBaseOutput.saveToArray()) {
  /** extracted name */
  const name = getNameFromStoreData(data);
  // base name will be name if it is defined
  let fileBaseName = name;
  if (!fileBaseName) {
    // otherwise compose a base name from the date and type
    fileBaseName = getFormattedTime() + '-from-mii-qr-code';
  }
  downloadData(data, fileBaseName + '.cfsd');
}

/**
 * Function to download extra data using {@link downloadData}.
 * @param {Uint8Array} [extraData] - The extra data to download.
 * @param {Uint8Array} [storeData] - The StoreData associated, to resolve a name.
 */
function downloadExtraData(extraData = hexEditorExtraOutput.saveToArray(),
  storeData = hexEditorBaseOutput.saveToArray()) {
  /** Extracted name from StoreData, or timestamp. */
  let prefix = '';
  if (!storeData || !(prefix = getNameFromStoreData(storeData))) {
    prefix = getFormattedTime();
  } // use in place of name

  let fileBaseName = getExtraDataGenericName(extraData.length);
  if (!fileBaseName) {
    fileBaseName = 'extra-mii-qr-data';
  }
  fileBaseName = prefix + '-' + fileBaseName;
  downloadData(extraData, fileBaseName + '.bin');
}

/** Clears the extra data input. */
function clearExtraData() {
  hexEditorExtraInput.clearData();
  /** @type {HTMLInputElement} */ (document.getElementById('load-extra-btn')).value = '';
}

// // ---------------------------------------------------------------------
// //  Helpers for Uploading Data
// // ---------------------------------------------------------------------

/**
 * Function to load StoreData from file.
 * @param {Event} event - The upload event.
 */
function loadStoreDataFromFile(event) {
  const files = /** @type {HTMLInputElement} */ (event.target).files;
  if (!files || !files[0]) {
    return;
  }

  const fileSize = files[0].size;
  if (fileSize < MII_DATA_CORE_LENGTH || fileSize > VER3_STORE_DATA_LENGTH) {
    alert(`StoreData (.cfsd) file must be between ${MII_DATA_CORE_LENGTH} and ${VER3_STORE_DATA_LENGTH} bytes.`);
    return;
  }

  const reader = new FileReader();
  reader.onload = function () {
    if (!(reader.result instanceof ArrayBuffer)) {
      console.warn('loadExtraDataFromFile: reader.result is not an ArrayBuffer.');
      return;
    }
    let baseData = new Uint8Array(reader.result);

    // Pad StoreData to 96 bytes if the size is smaller.
    if (baseData.length < VER3_STORE_DATA_LENGTH) {
      const paddedBaseData = new Uint8Array(VER3_STORE_DATA_LENGTH);
      paddedBaseData.set(baseData); // Copy original data
      baseData = paddedBaseData; // Replace with padded data
    }

    // Load into the hex editor for base data (StoreData)
    hexEditorBaseInput.loadFromArray(baseData);
  };

  reader.readAsArrayBuffer(files[0]);
}

/**
 * Function to load extra data from file.
 * @param {Event} event - The upload event.
 */
function loadExtraDataFromFile(event) {
  const files = /** @type {HTMLInputElement} */ (event.target).files;
  if (!files || !files[0]) {
    return;
  }

  const reader = new FileReader();
  reader.onload = function () {
    if (!(reader.result instanceof ArrayBuffer)) {
      console.warn('loadExtraDataFromFile: reader.result is not an ArrayBuffer.');
      return;
    }
    const extraData = new Uint8Array(reader.result);

    // Load into the hex editor for extra data
    hexEditorExtraInput.loadFromArray(extraData);
  };

  reader.readAsArrayBuffer(files[0]);
}

// // ---------------------------------------------------------------------
// //  Page Setup
// // ---------------------------------------------------------------------

/**
 * Event listener for hex input field to handle both hex and base64.
 * @param {HexEditor} hexEditorInstance - The hex editor instance.
 */
function setupHexEditorPasteHandling(hexEditorInstance) {
  const hexTextArea = hexEditorInstance.textArea;

  hexTextArea.addEventListener('paste',
  /** @param {ClipboardEvent} event - The paste event. */ (event) => {
      event.preventDefault();

      if (!event.clipboardData) {
        return;
      }
      const pasteData = event.clipboardData.getData('text').trim().replace(/\s+/g, '');

      // If the pasted data is not valid hex, try to decode as base64
      if (!isHex(pasteData)) {
        if (isBase64(pasteData)) {
        // Decode base64 and load as hex into the HexEditor
          const decodedBase64 = base64ToBytes(pasteData);
          hexEditorInstance.loadFromArray(decodedBase64);
        } else {
          alert('Invalid hex or base64 data.');
        }
      } else {
      // Process valid hex normally
        hexEditorInstance.textArea.value = pasteData.replace(/(.{2})/g, '$1 ').trim();
      }

      hexEditorInstance.textArea.dispatchEvent(new Event('input'));
    });
}

/** @type {ReturnType<QrScanner>} */
let cameraScanner;

const camList = /** @type {HTMLSelectElement} */ (document.getElementById('cam-list'));

const startCameraButton = /** @type {HTMLButtonElement} */ (document.getElementById('start-camera'));
const stopCameraButton = /** @type {HTMLButtonElement} */ (document.getElementById('stop-camera'));

// Initialize hex editors for the inputs and outputs
/** @type {HexEditor} */ let hexEditorBaseInput;
/** @type {HexEditor} */ let hexEditorExtraInput;
/** @type {HexEditor} */ let hexEditorBaseOutput;
/** @type {HexEditor} */ let hexEditorExtraOutput;

document.addEventListener('DOMContentLoaded', () => {
  /**
   * List of EITHER element IDs OR variable names that
   * should be guaranteed non-null in JSDoc, and will
   * be filtered down to elements that do not exist.
   */
  const missing = [
    // Constants set from elements.
    'qrCodeContainer', 'extraDataWarning', 'extraDataWarningInner',
    'cameraScanner', 'camList',
    // Element IDs that are not constants.
    'qr-video', 'file-input', 'key-type', 'qr-modify-storedata',
    'generate-qr-code', 'download-store-data', 'download-extra-data',
    'load-storedata-btn', 'load-extra-btn', 'clear-extra-data'
  ]
    // @ts-ignore - it is indexable by string and we just set above
    .filter(id => !(globalThis[id] instanceof HTMLElement));
  if (missing.length) {
    // alert(`HTML elements not found: ${missing.join(', ')}`);
  }

  hexEditorBaseInput = new HexEditor(document.getElementById('hex-editor-storedata'), false);

  setupHexEditorPasteHandling(hexEditorBaseInput); // Attach paste handling to this instance

  hexEditorExtraInput = new HexEditor(document.getElementById('hex-editor-extra'), false);
  hexEditorBaseOutput = new HexEditor(document.getElementById('hex-editor-decrypt-storedata'), true);
  hexEditorExtraOutput = new HexEditor(document.getElementById('hex-editor-decrypt-extra'), true);

  // QR Code Scanner for decoding
  cameraScanner = new QrScanner(document.getElementById('qr-video'),
    handleQrCode, {
      highlightScanRegion: true,
      highlightCodeOutline: true
    });

  // // ---------------------------------------------------------------------
  // //  Event Listeners
  // // ---------------------------------------------------------------------

  /** @type {HTMLButtonElement} */ (document.getElementById('generate-qr-code'))
    .addEventListener('click', () => {
      generateQrCode();
    });
  /** @type {HTMLButtonElement} */ (document.getElementById('download-store-data'))
    .addEventListener('click', () => {
      downloadStoreData();
    });
  /** @type {HTMLButtonElement} */ (document.getElementById('download-extra-data'))
    .addEventListener('click', () => {
      downloadExtraData();
    });
  /** @type {HTMLButtonElement} */ (document.getElementById('clear-extra-data'))
    .addEventListener('click', () => {
      clearExtraData();
    });
  /** @type {HTMLInputElement} */ (document.getElementById('load-storedata-btn'))
    .addEventListener('change', loadStoreDataFromFile);
  /** @type {HTMLInputElement} */ (document.getElementById('load-extra-btn'))
    .addEventListener('change', loadExtraDataFromFile);

  startCameraButton.addEventListener('click', () => {
    cameraScanner.start().then(() => {
      // List cameras after the scanner started to avoid listCamera's stream and the scanner's stream being requested
      // at the same time which can result in listCamera's unconstrained stream also being offered to the scanner.
      // Note that we can also start the scanner after listCameras, we just have it this way around in the demo to
      // start the scanner earlier.
      const existingCameras = document.getElementsByClassName('device-camera');
      [...existingCameras].forEach((camera) => {
        // go ahead and remove all existing cameras to repopulate camera list
        camera.remove();
      });
      /** @type {Promise<Array<{id: string, label: string}>>} */ (QrScanner.listCameras(true)).then(
        cameras => cameras.forEach((camera) => {
          const option = document.createElement('option');
          option.value = camera.id;
          option.text = camera.label;
          option.className = 'device-camera';
          camList.add(option);
        }));
    });
  });

  camList.addEventListener('change', (event) => {
    cameraScanner.setCamera(/** @type {HTMLInputElement} */(event.target).value);
  });

  stopCameraButton.addEventListener('click', () => {
    if (cameraScanner) {
      cameraScanner.stop();
    }
  });

  /** @type {HTMLInputElement} */ (document.getElementById('file-input')).addEventListener('change', (event) => {
    const files = /** @type {HTMLInputElement} */ (event.target).files;
    if (files && files[0]) {
      QrScanner.scanImage(files[0], { returnDetailedScanResult: true })
        .then(handleQrCode);
    }
  });

  /** @type {HTMLInputElement} */ (document.getElementById('key-type')).addEventListener('change', (event) => {
    const type = /** @type {HTMLInputElement} */ (event.target).value;
    const newKey = AES_CCM_KEYSLOT_0x31_KEYS[Number(type)];
    gAESCCMKeyPrimary = newKey;
    console.debug('key changed to: ' + gAESCCMKeyPrimary);
  });

  /** @type {HTMLInputElement} */ (document.getElementById('qr-modify-storedata')).addEventListener('change', (event) => {
    const enable = /** @type {HTMLInputElement} */ (event.target).checked;
    console.debug('modify storedata for qr:', enable);
    gModifyStoreDataForQr = enable;
  });

  // Initialize QR Scanner
  QrScanner.hasCamera().then(/** @param {boolean} hasCamera - Presence of camera. */(hasCamera) => {
    if (!hasCamera) {
      startCameraButton.disabled = true;
    }
    if (!hasCamera) {
      stopCameraButton.disabled = true;
    }
  });

  // test: type Jasmine into input
  /*
  (function simulatePasteStoreData(base64) {
    const targetTextArea = hexEditorBaseInput.textArea;
    if (!targetTextArea) {
      return;
    }

    const clipboardEvent = new ClipboardEvent('paste', { clipboardData: new DataTransfer() });
    // hack to work around non-writable clipboardData in some environments
    Object.defineProperty(clipboardEvent, 'clipboardData',
      { value: { getData: () => base64 } });
    targetTextArea.dispatchEvent(clipboardEvent);
  })(jasmineStoreData);
  */
});
