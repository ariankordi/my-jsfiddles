// @ts-check

/* eslint @stylistic/indent: ['error', 2] -- Define indent rules. */

/**
 * AES key at "Type 2, slot 0x31" in sjcl's representation.
 * https://www.3dbrew.org/wiki/PSPXI:EncryptDecryptAes#Key_Types
 */
const AES_CCM_KEYSLOT_0x31_KEY = sjcl.codec.hex.toBits('59FC817E6446EA6190347B20E9BDCE52');

const AES_CCM_KEYSLOT_0x31_KEY_DEV = sjcl.codec.hex.toBits('12DF92B6FFD438AB291C4FD4D7CE256D');

/** Size of encrypted Mii data found in QR codes (CFLiWrappedMiiData, FFLiWrappedStoreData) */
const WRAPPED_MII_DATA_LENGTH = 112; // 0x70

/** Size of 3DS/Wii U format Mii data, referred to as: FFLStoreData, CFLiMiiDataPacket, nn::mii::Ver3StoreData */
const VER3_STORE_DATA_LENGTH = 96; // 0x60

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
function encryptAesCcm(dst, storeData, key = AES_CCM_KEYSLOT_0x31_KEY) {
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
const getNameFromCFSD = data => extractUTF16LEText(data, 0x1A);

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
  const key = AES_CCM_KEYSLOT_0x31_KEY_DEV;

  // encode test
  const wrapped = new Uint8Array(WRAPPED_MII_DATA_LENGTH);
  encryptAesCcm(wrapped, WRAP_TEST_DATA, key);

  if (!uint8ArrayCmp(WRAP_EXPECTED, wrapped)) {
    onMismatch(WRAP_EXPECTED, wrapped);
    return;
  }

  // decode test
  /*
  const storeData = new Uint8Array(VER3_STORE_DATA_LENGTH);
  decryptAesCcm(storeData, wrapped, key);
  if (!uint8ArrayCmp(WRAP_TEST_DATA, storeData)) {
    onMismatch(WRAP_TEST_DATA, storeData);
    return;
  }
  */
  console.info('encryptAesCcmTest: ✅ passed encode');
}

encryptAesCcmTest();


// Function to detect if the string is base64 or hex
function detectAndDecodeInput(input) {
  input = input.trim();
  
  // Check if it looks like a hex string (only contains valid hex characters)
  const hexRegex = /^[0-9a-fA-F]+$/;
  if (hexRegex.test(input)) {
    const hexArray = input.match(/.{1,2}/g).map(byte => parseInt(byte, 16));
    return new Uint8Array(hexArray);
  }

  // Otherwise, assume it's Base64
  try {
    return Uint8Array.from(atob(input), c => c.charCodeAt(0));
  } catch (e) {
    throw new Error("Invalid input: not a valid Base64 or Hex string.");
  }
}

// Happens when the form is submitted
function processData(event) {
  event.preventDefault();

  const fileInput = document.getElementById('fileInput');
  const miiDataInput = document.getElementById('miiDataInput');
  const reader = new FileReader();

  reader.onload = function(e) {
    const rawData = new Uint8Array(VER3_STORE_DATA_LENGTH);
    rawData.set(e.target.result);
    processAndDisplayQR(rawData);
  };

  if (fileInput.files.length > 0) {
    reader.readAsArrayBuffer(fileInput.files[0]);
  } else if (miiDataInput.value.trim() !== '') {
    try {
      const decodedData = new Uint8Array(VER3_STORE_DATA_LENGTH);
      decodedData.set(detectAndDecodeInput(miiDataInput.value));
      processAndDisplayQR(decodedData);
    } catch (error) {
      alert(error.message);
      return;
    }
  } else {
    alert("Please provide a file or Base64/Hex Mii data.");
    return;
  }

  // Clear the input fields
  fileInput.value = '';
  miiDataInput.value = '';
}

function processAndDisplayQR(data) {
  // Modify the data to allow copying and scanning on 3DS.
  modifyStoreDataCopyablePlatform(data);
  // Update the CRC-16 in the data.
  updateStoreDataCRC(data);

  const encrypted = new Uint8Array(WRAPPED_MII_DATA_LENGTH);
  encryptAesCcm(encrypted, data);

  // To match the original QR codes, change modulesize to 2.
  const options = { margin: 0, modulesize: 6, ecclevel: 'H' };

  const qr = QRCode.generateHTML(encrypted, options);

  const li = document.createElement('li');

  // Extract UTF-16 LE Mii name
  const utf16leMiiName = getNameFromCFSD(data);
  utf16leMiiName && (li.textContent = utf16leMiiName);

  li.appendChild(qr);
  const qrList = document.getElementById('qrList');
  qrList.insertBefore(li, qrList.firstChild); // Add to the top
}