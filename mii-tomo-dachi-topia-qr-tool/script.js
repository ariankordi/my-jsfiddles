// @ts-check
/* eslint indent: ['error', 2] -- Define indent rules. */
/* eslint no-multi-spaces: 'off' -- Allow spaced comments. */

import QrScanner from '@getify-as-is/qr-scanner';
import QRCode from 'qrjs';
// import HexEditor from './qr-crypt-HexEditor.js';
// import { KeyType, AES_CCM_KEYSLOT_0x31_KEYS, WrappedMiiDataSjcl } from './qr-crypt-WrappedMiiData.js';

/** A hex editor class for displaying and editing hex data within a container. */
class HexEditor {
  /**
   * Creates an instance of HexEditor.
   * @param {HTMLElement|null} container - The container element that holds the hex editor components.
   * @param {boolean} [isReadOnly] - Determines if te hex editor should be read-only.
   * @throws {Error} Throws if any of the required elements do not exist.
   */
  constructor(container, isReadOnly = false) {
    if (!container) {
      throw new Error('HexEditor: Passed in container is null.');
    }
    /**
     * Text area for hex input.
     * @type {HTMLTextAreaElement|null}
     */
    const textArea = container.querySelector('.hex-textarea');
    if (!(textArea instanceof HTMLTextAreaElement)) {
      throw new TypeError('HexEditor: Missing or invalid .hex-textarea element.');
    }
    this.textArea = textArea;

    /**
     * Element for storing line numbers.
     * @type {HTMLElement|null}
     */
    const lineNumbers = container.querySelector('.line-numbers');
    if (!(lineNumbers instanceof HTMLElement)) {
      throw new TypeError('HexEditor: Missing or invalid .line-numbers element.');
    }
    this.lineNumbers = lineNumbers;

    /**
     * Element for ASCII/Unicode output.
     * @type {HTMLElement|null}
     */
    const asciiOutput = container.querySelector('.ascii-output');
    if (!(asciiOutput instanceof HTMLElement)) {
      throw new TypeError('HexEditor: Missing or invalid .ascii-output element.');
    }
    this.asciiOutput = asciiOutput;

    /**
     * Hex header element (00, 01, 02...)
     * @type {HTMLElement|null}
     */
    const header = container.querySelector('.table-padding');
    if (!(header instanceof HTMLElement)) {
      throw new TypeError('HexEditor: Missing or invalid .table-padding element.');
    }
    this.header = header;

    /**
     * Reference to the table container.
     * @type {HTMLElement}
     */
    this.container = container;

    /** @type {boolean} */
    this.isReadOnly = isReadOnly;

    /** @type {'ascii' | 'utf16le' | 'utf16be'} */
    this.encodingMode = 'ascii';

    // Event listener for hex textarea selection to synchronize selection with ASCII output.
    this.textArea.addEventListener('select', () => this.syncSelection('hex'));

    // Event listener on the ASCII output to clear hex highlights on mouse down.
    this.asciiOutput.addEventListener('mousedown', () => this.clearHexHighlights());

    this.initTopCell(); // Initialize the top row with hex values (00, 01, 02, ..., 0F)
    this.bindTextAreaInput(); // Bind input event to handle hex editing

    // Set the text area to read-only if applicable.
    if (isReadOnly) {
      this.textArea.setAttribute('readonly', 'readonly');
    }
  }

  /** Initializes the top row of the editor with hexadecimal values (00 to 0F). */
  initTopCell() {
    let headerContent = '';
    for (let i = 0; i < 16; i++) {
      headerContent += (0 + i.toString(16)).slice(-2) + ' '; // Convert numbers to hex and append to header
    }
    this.header.textContent = headerContent; // Set the header content
  }

  /** Binds the input event to the hex text area to handle editing. */
  bindTextAreaInput() {
    this.textArea.addEventListener('input', () => {
      const caretPosition = this.textArea.selectionStart;
      /** Cleaned and formatted hex input. */
      const cleanHex = this.cleanHexInput(caretPosition);
      this.updateLineNumbers(cleanHex); // Update the line numbers based on hex data
      this.updateAsciiOutput(cleanHex); // Update the ASCII/Unicode output based on hex data
      this.adjustTextAreaHeight(cleanHex); // Adjust the textarea height dynamically
    });
  }

  /**
   * Cleans and formats the hex input while maintaining the caret position.
   * @param {number} caretPosition - The current caret position in the text area.
   * @returns {string} The cleaned and formatted hex string.
   */
  cleanHexInput(caretPosition) {
    /** Current value from the textarea. */
    let hexValue = this.textArea.value;
    // Clean and format the hex input, maintaining the caret position
    let beforeCaret = hexValue
      .slice(0, caretPosition) // Get the slice before the caret
      .replace(/[^0-9A-F]/gi, '') // Strip non-hex characters
      .replace(/(..)/g, '$1 ') // Add a space between every two hex digits
      .length;

    hexValue = hexValue
      .replace(/[^0-9A-F]/gi, '') // Remove non-hex characters globally
      .replace(/(..)/g, '$1 ') // Add a space every two hex characters
      .replace(/ $/, '') // Remove trailing space
      .toUpperCase(); // Convert to uppercase for consistency

    this.textArea.value = hexValue; // Update textarea with cleaned hex

    // Handle caret positioning correctly when there's a space
    if (hexValue[beforeCaret] === ' ') {
      beforeCaret--;
    }
    this.textArea.setSelectionRange(beforeCaret, beforeCaret); // Restore caret position

    return hexValue; // Return cleaned hex string
  }

  /**
   * Updates the line numbers based on the length of the cleaned hex string.
   * @param {string} cleanHex - The cleaned hex string.
   */
  updateLineNumbers(cleanHex) {
    /** String for line numbers. */
    let lineNumberString = '';
    for (let i = 0; i < cleanHex.length / 48; i++) {
      lineNumberString += (1e7 + (16 * i).toString(16)).slice(-8) + ' '; // Calculate and append each line number
    }
    this.lineNumbers.textContent = lineNumberString; // Update the line numbers display
  }

  /**
   * Updates the ASCII/Unicode output based on the cleaned hex string and the selected encoding mode.
   * @param {string} cleanHex - The cleaned hex string.
   */
  updateAsciiOutput(cleanHex) {
    /** String for ASCII/Unicode output. */
    let asciiString = '';

    // ASCII encoding mode
    if (this.encodingMode === 'ascii') {
      // Read every byte for ASCII
      for (let i = 0; i < cleanHex.length; i += 3) {
        /** Hex converted to character code. */
        const charCode = Number.parseInt(cleanHex.slice(i, i + 2), 16);
        // Add valid character or dot.
        asciiString += (32 < charCode && charCode < 127)
          ? String.fromCharCode(charCode)
          : '.';
      }
    } else {
      // UTF-16 encoding mode (handles both LE and BE)
      for (let i = 0; i < cleanHex.length; i += 6) { // Read every two bytes for UTF-16
        const byte1 = Number.parseInt(cleanHex.slice(i, i + 2), 16);
        const byte2 = Number.parseInt(cleanHex.slice(i + 3, i + 5), 16);

        // Handle little-endian or big-endian decoding
        const charCode = (this.encodingMode === 'utf16le')
          ? (byte2 << 8) + byte1 // Little-endian: lower byte first
          : (byte1 << 8) + byte2; // Big-endian: higher byte first

        // Skip control characters and null bytes (0x00)
        asciiString += (charCode !== 0 && charCode >= 32)
          ? String.fromCharCode(charCode) // Add valid Unicode character
          : '.'; // Replace non-printable characters with a dot
      }
    }

    // Insert spaces after every 16 characters.
    this.asciiOutput.textContent = asciiString.replace(/(.{16})/g, '$1 ');
  }

  /**
   * Dynamically adjusts the height of the text area based on its content length.
   * @param {string} cleanHex - The cleaned hex string.
   */
  adjustTextAreaHeight(cleanHex) {
    this.textArea.style.height = (1.5 + cleanHex.length / 47) + 'em'; // Dynamically adjust height based on content
  }

  /**
   * Loads data from a Uint8Array into the hex editor.
   * @param {Uint8Array} uint8Array - The array of bytes to load into the editor.
   */
  loadFromArray(uint8Array) {
    let hexString = '';
    for (const byte of uint8Array) {
      // Convert each byte to hex string and append.
      hexString += (0 + byte.toString(16)).slice(-2) + ' '; // Trigger input event to update the editor
    }
    this.textArea.value = hexString.trim(); // Set textarea value with the hex string
    this.textArea.dispatchEvent(new Event('input'));
  }

  /**
   * Saves the current hex data from the text area into a Uint8Array.
   * @returns {Uint8Array<ArrayBuffer>} The Uint8Array containing the hex data.
   */
  saveToArray() {
    /** Cleaned hex string. */
    const cleanHex = this.cleanHexInput(this.textArea.selectionStart).replace(/ /g, '');
    /** Uint8Array to hold the hex data. */
    const byteArray = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < cleanHex.length; i += 2) {
      byteArray[i / 2] = Number.parseInt(cleanHex.slice(i, i + 2), 16); // Convert hex to bytes
    }
    return byteArray; // Return Uint8Array
  }

  /** Clears the data within the text area. */
  clearData() {
    this.textArea.value = '';
    this.textArea.dispatchEvent(new Event('input'));
  }

  /**
   * Synchronizes the selection between the hex view and the ASCII/Unicode view.
   * @param {'hex' | 'ascii'} [source] - The source of the selection (expected "hex").
   * @throws {Error} Throws if source is not "hex" ("ascii" is unimplemented).
   */
  syncSelection(source = 'hex') {
    if (source !== 'hex') {
      throw new Error('HexEditor.syncSelection: Unexpected value for source (unimplemented)');
    }
    /** Start of the selection. */
    const selectionStart = this.textArea.selectionStart;
    /** End of the selection. */
    const selectionEnd = this.textArea.selectionEnd;

    // Variables to hold the start and end positions for ASCII selection
    let asciiStart;
    let asciiEnd;

    // Calculate start and end positions for ASCII selection
    if (this.encodingMode === 'ascii') {
      asciiStart = Math.floor(selectionStart / 3); // Every 3 hex chars = 1 byte
      // Use Math.ceil for selectionEnd to ensure the last character is included
      asciiEnd = Math.ceil(selectionEnd / 3);
    } else {
      asciiStart = Math.floor(selectionStart / 6); // Every 6 hex chars (2 bytes) = 1 UTF-16 char
      asciiEnd = Math.ceil(selectionEnd / 6); // Ensure last Unicode character is included
    }

    // Ensure asciiStart and asciiEnd are within bounds of the content
    asciiStart = Math.max(asciiStart, 0);
    asciiEnd = Math.min(asciiEnd,
      this.asciiOutput.textContent ? this.asciiOutput.textContent.length : 0);

    // Highlight the corresponding text in ASCII output
    this.highlightAscii(asciiStart, asciiEnd);
  }

  /**
   * Escapes HTML special characters in a string.
   * @param {string} unsafe - The string to escape.
   * @returns {string} The escaped string.
   */
  static escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Highlights a portion of the ASCII/Unicode view corresponding to a given range.
   * @param {number} start - The starting index in the ASCII output.
   * @param {number} end - The ending index in the ASCII output.
   */
  highlightAscii(start, end) {
    const asciiContent = this.asciiOutput.textContent;
    if (!asciiContent) {
      return; // There is no text to highlight.
    }

    // Adjust start and end to account for line breaks (spaces added every 16 characters)
    /** Adjustment to account for added space every 16 characters. */
    const adjustedStart = start + Math.floor(start / 16);
    /** Similar adjustment to `adjustedStart` for the end position. */
    const adjustedEnd = end + Math.floor(end / 16);

    const highlightedText = asciiContent.slice(adjustedStart, adjustedEnd);

    const preText = asciiContent.slice(0, adjustedStart);
    const postText = asciiContent.slice(adjustedEnd);

    // Rebuild the ASCII content with the highlighted selection
    this.asciiOutput.innerHTML = `${HexEditor.escapeHtml(preText)}<mark>${HexEditor.escapeHtml(highlightedText)}</mark>${HexEditor.escapeHtml(postText)}`;
  }

  /** Clears any highlights in the ASCII/Unicode view. */
  clearHexHighlights() {
    // Remove all <mark> tags.
    this.asciiOutput.innerHTML = this.asciiOutput.innerHTML
      .replace(/<mark>/g, '')
      .replace(/<\/mark>/g, '');
  }
}

/**
 * Implementation for "WrappedStoreData", aka the encryption used
 * in Mii QR codes (among other uses on the 3DS), in JavaScript.
 *
 * References (Credits: 3DBrew contributors, jaames, kazuki-4ys):
 * - https://www.3dbrew.org/wiki/Mii_Maker#Mii_QR_Code_format
 * - (Only decryption) https://gist.github.com/jaames/96ce8daa11b61b758b6b0227b55f9f78
 * - https://github.com/kazuki-4ys/kazuki-4ys.github.io/blob/148dc339974f8b7515bfdc1395ec1fc9becb68ab/web_apps/MiiInfoEditorCTR/encode.js#L57, encryption: https://github.com/kazuki-4ys/kazuki-4ys.github.io/blob/148dc339974f8b7515bfdc1395ec1fc9becb68ab/web_apps/MiiInfoEditorCTR/encode.js#L46
 * - CFL: void CFLi_UnwrapMiiData(CFLiMiiDataPacket* packetData, CFLiWrappedMiiData* wrappedData);
 * -> nn::applet::CTR::detail::Unwrap(packetData, wrappedData, 0x70, 0xc, 10);
 * -> nn::ps::UnwrapMii(void* pMiiBuffer, const void* pWrapped, size_t wrappedSize, s32 idOffset, size_t idSize);
 * - CFL: void CFLi_WrapMiiData(CFLiWrappedMiiData* wrappedData, CFLiMiiDataPacket* packetData);
 * -> nn::applet::CTR::detail::Wrap(wrappedData,packetData, 0x60, 0xc, 10);
 * -> nn::ps::WrapMii(void* pWrappedBuffer, const void* pMii, size_t miiSize, s32 idOffset, size_t idSize);
 * (> ctr.7z: ctr/sources/libraries/ps/CTR/ps_Util.cpp)
 * - FFL: FFLResult FFLiUnwrapStoreData(FFLiStoreDataCFL*, const FFLiWrappedStoreData*);
 * -> ACPMiiUnwrap(pStoreDataCFL, FFL_MIIDATA_PACKET_SIZE, pWrappedStoreData, FFLI_WRAPPEDSTOREDATA_SIZE);
 * - FFL: FFLResult FFLiWrapStoreData(FFLiWrappedStoreData*, const FFLiStoreDataCFL*);
 * -> ACPMiiWrap(pWrappedStoreData, FFLI_WRAPPEDSTOREDATA_SIZE, pWrappedStoreData, FFL_MIIDATA_PACKET_SIZE);
 */
// @ts-check

import * as sjcl from 'sjcl-with-all-without-require-crypto';

// // ---------------------------------------------------------------------
// //  AES Keys
// // ---------------------------------------------------------------------

/** @enum {number} */
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
  [KeyType.Production]: /* @__PURE__ */ sjcl.codec.hex.toBits('59FC817E6446EA6190347B20E9BDCE52'),
  /** Development key. */
  [KeyType.Development]: /* @__PURE__ */ sjcl.codec.hex.toBits('12DF92B6FFD438AB291C4FD4D7CE256D'),
  /** Null key (used in Citra). */
  [KeyType.Null]: /* @__PURE__ */ sjcl.codec.hex.toBits('00000000000000000000000000000000')
};

class WrappedMiiDataSjcl {
  /** Size of encrypted Mii data found in QR codes (CFLiWrappedMiiData, FFLiWrappedStoreData) */
  static WrappedLength = 112; // 0x70

  /** Size of 3DS/Wii U format Mii data, referred to as: FFLStoreData, CFLiMiiDataPacket, nn::mii::Ver3StoreData */
  static StoreDataLength = 96; // 0x60

  /**
   * Gets 96 byte 3DS/Wii U format Mii data from QR code data.
   * Decrypts the AES-CCM encrypted data (CFLiWrappedMiiData) from the QR code using sjcl.
   *
   * The default AES-CCM decryption function in sjcl fails to verify the tag (MAC)
   * due to the following errata: https://www.3dbrew.org/wiki/AES_Registers#CCM_mode_pitfall
   * In order to skip verification of the tag (MAC), a private function to
   * decrypt without verifying is used, obtained by {@link getSjclCcmCtrModeDecryptFunc}.
   *
   * @param {Uint8Array} dst - Destination to write the decrypted StoreData to.
   * Expected size is {@link StoreDataLength}.
   * @param {Uint8Array} encryptedData - Encrypted "wrapped" Mii QR code data (CFLiWrappedMiiData)
   * @param {ArrayLike<number>} key - The key to pass into sjcl.
   * @returns {void}
   * @throws {Error} Throws if the input data's size doesn't match {@link WrappedLength}.
   * @todo Need to implement verifying the tag (MAC) using the private _computeTag function:
   * https://github.com/bitwiseshiftleft/sjcl/blob/85caa53c281eeeb502310013312c775d35fe0867/core/ccm.js#L109
   * Until then, you MUST verify the CRC-16 of the output to ensure the data is valid.
   */
  static decrypt(dst, encryptedData, key) {
    const NonceLength = 12;
    const TagLength = 16;
    const IdLength = 8; // = (sizeof(FFLCreateID) = 10) & ~3

    if (encryptedData.length < WrappedMiiDataSjcl.WrappedLength) { // Verify length.
      throw new Error(`Input size is ${encryptedData.length}, expected ${WrappedMiiDataSjcl.WrappedLength} or longer.`);
    }

    /** AES-CCM nonce (like an IV) initialized to zeroes. Usually 8 bytes padded to 12 bytes. */
    const nonce = new Uint8Array(NonceLength);
    nonce.set(encryptedData.subarray(0, IdLength)); // Extract the ID into the nonce.
    const encryptedContent = encryptedData.subarray(IdLength);

    // Convert encrypted content and nonce to sjcl.BitArray (toBits expects array).
    // @ts-ignore -- Works with Uint8Array.
    const encryptedBits = sjcl.codec.bytes.toBits(encryptedContent);
    // @ts-ignore -- Works with Uint8Array.
    const nonceBits = sjcl.codec.bytes.toBits(nonce);

    // Isolate the actual ciphertext from the tag and adjust IV.
    // Copied from sjcl.mode.ccm.decrypt: https://github.com/bitwiseshiftleft/sjcl/blob/85caa53c281eeeb502310013312c775d35fe0867/core/ccm.js#L83
    /** Tag length in bits. */
    const tlen = TagLength * 8;
    const dataWithoutTag = sjcl.bitArray.clamp(encryptedBits,
      // remove tag from out, tag length = 128
      sjcl.bitArray.bitLength(encryptedBits) - tlen);

    // Get the decrypt function. TODO: Cache this in a global?
    const ctrDecrypt = WrappedMiiDataSjcl.getSjclCcmCtrModeDecryptFunc();

    const cipher = new sjcl.cipher.aes(key);

    const decryptedBits = ctrDecrypt(cipher, dataWithoutTag,
      // hardcoding 3 as "L" / length
      nonceBits, [], tlen, 3);
    // NOTE: The tag (CBC-MAC) within the encrypted data is NOT verified here.

    // Convert the decrypted bytes from sjcl.BitArray format.
    const decryptedArray = sjcl.codec.bytes.fromBits(decryptedBits.data);
    // Create a Uint8Array so that we can slice and copy from it.
    const decryptedBytes = new Uint8Array(decryptedArray)
      .subarray(0, WrappedMiiDataSjcl.WrappedLength - IdLength);

    // Create the final Mii StoreData from the decrypted bytes.
    // const dst = new Uint8Array(encryptedData.length);
    dst.set(decryptedBytes.subarray(0, NonceLength)); // First 12 decrypted bytes.
    dst.set(nonce, NonceLength); // Original nonce from the encrypted bytes.
    // Copy the rest of the decrypted bytes.
    dst.set(decryptedBytes.subarray(NonceLength),
      NonceLength + IdLength);
  }

  /**
   * Encrypts 3DS/Wii U Mii data with AES-CCM (CFLiWrappedMiiData)
   * using sjcl for use in a Mii QR code.
   * @param {Uint8Array} dst - Destination to write the
   * encrypted QR code data (CFLiWrappedMiiData) to. Expected size is {@link WrappedLength}.
   * @param {Uint8Array} storeData - Input 96 byte StoreData to encrypt.
   * @param {ArrayLike<number>} [key] - The key to pass into sjcl.
   * @returns {void}
   * @throws {Error} Throws if the input data's size doesn't match {@link StoreDataLength}.
   */
  static encrypt(dst, storeData, key) {
    const NonceLength = 12;
    const TagLength = 16;
    const IdOffset = 12;
    const IdLength = 8;

    if (storeData.length !== WrappedMiiDataSjcl.StoreDataLength) { // Verify length.
      throw new Error(`Input size is ${storeData.length}, expected ${WrappedMiiDataSjcl.StoreDataLength} / 3DS/Wii U format Mii StoreData.`);
    }

    /** Offset after the ID ends. */
    const idEndOffset = IdOffset + IdLength;
    /** The ID to include in the encrypted data as the nonce (IV). */
    const wrappedID = storeData.subarray(IdOffset, idEndOffset);

    /** The content to be encrypted. Consists of the data with the ID cut out, and with extra padding. */
    const content = new Uint8Array(
      // Size: 96-len(id) (= 88) + len(id) = 96
      WrappedMiiDataSjcl.StoreDataLength);
    content.set(storeData.subarray(0, IdOffset)); // Copy until the ID.
    content.set(storeData.subarray(idEndOffset), IdOffset); // Copy after the ID.
    // This leaves 8 bytes of padding.

    /** AES-CCM nonce (like an IV) initialized to zeroes. */
    const nonce = new Uint8Array(NonceLength);
    nonce.set(wrappedID); // Set the ID in the nonce, leaving extra padding.
    // @ts-ignore -- Works with Uint8Array.
    const nonceBits = sjcl.codec.bytes.toBits(nonce);
    // @ts-ignore -- Works with Uint8Array.
    const contentBits = sjcl.codec.bytes.toBits(content);

    const cipher = new sjcl.cipher.aes(key);

    const tlen = TagLength * 8;
    // Encrypt the padded StoreData with the ID cut out, using the ID as a nonce (IV).
    const encryptedBits = sjcl.mode.ccm.encrypt(cipher, contentBits, nonceBits, undefined, tlen);
    const encryptedBytes = new Uint8Array(sjcl.codec.bytes.fromBits(encryptedBits));

    // The encrypted bytes are padded and the tag is at the end.
    const contentLength =
      encryptedBytes.length - IdLength - TagLength;
    // The data is spliced to remove the extra padding in the middle.
    const encryptedContent = encryptedBytes.subarray(0, contentLength);
    const tag = encryptedBytes.subarray(encryptedBytes.length - TagLength);

    // const dst = new Uint8Array(WRAPPED_MII_DATA_LENGTH);
    dst.set(wrappedID); // Set nonce from the original data.
    dst.set(encryptedContent, IdLength); // Encrypted content.
    dst.set(tag, WrappedMiiDataSjcl.StoreDataLength); // Set tag after content + nonce.
  }

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
   * @private
   */
  static getSjclCcmCtrModeDecryptFunc() {
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
}

/** Tests {@link WrappedMiiDataSjcl.encrypt} against known good data. */
/*
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

  // Expected test data is using dev key.
  const key = AES_CCM_KEYSLOT_0x31_KEYS[Number(KeyType.Development)];

  // encode test
  const wrapped = new Uint8Array(WrappedMiiDataSjcl.WrappedLength);
  WrappedMiiDataSjcl.encrypt(wrapped, WRAP_TEST_DATA, key);

  for (let i = 0; i < WRAP_EXPECTED.length; i++) {
    if (WRAP_EXPECTED[i] !== wrapped[i]) {
      console.error('mismatch:', WRAP_EXPECTED, wrapped);
      return;
    }
  }

  // decode test
  const storeData = new Uint8Array(WrappedMiiDataSjcl.StoreDataLength);
  WrappedMiiDataSjcl.decrypt(storeData, wrapped, key);

  for (let i = 0; i < WRAP_TEST_DATA.length; i++) {
    if (WRAP_TEST_DATA[i] !== storeData[i]) {
      console.error('mismatch:', WRAP_TEST_DATA, storeData);
      return;
    }
  }

  console.info('encryptAesCcmTest: ✅ passed (en/de)code');
}

encryptAesCcmTest();
*/

//ex//port {
//  KeyType, AES_CCM_KEYSLOT_0x31_KEYS,
//  WrappedMiiDataSjcl
//};

// @ts-ignore - HACK because jsfiddle blocks this word???
const crpyto = globalThis['crypt' + 'o'];
/**
 * Shortcut to SubtleCr*pto.
 * @todo NOTE: You may have to change this in your own setup.
 */
const sc = /** @type {SubtleCrypto} */ (crpyto.subtle);
// ^^ Needed or else the fiddle will not save

// // ---------------------------------------------------------------------
// //  Constants
// // ---------------------------------------------------------------------

/**
 * Size of 3DS/Wii U format Mii data, referred to as:
 * FFLStoreData, CFLiMiiDataPacket, nn::mii::Ver3StoreData
 */
const VER3_STORE_DATA_LENGTH = 96; // 0x60

/** Test StoreData. */
const jasmineStoreData = 'AwAAQKBBOMSghAAA27iHMb5gKyoqQgAAWS1KAGEAcwBtAGkAbgBlAAAAAAAAABw3EhB7ASFuQxwNZMcYAAgegg0AMEGzW4JtAABvAHMAaQBnAG8AbgBhAGwAAAAAAJA6';

// Global settings.

/** Reassigned to dev/prod. */
let aesCcmKeyPrimary = AES_CCM_KEYSLOT_0x31_KEYS[KeyType.Production];

/**
 * Determines if the StoreData will be modified before making
 * a QR code. ({@link StoreDataUtility.modifyForQrCode})
 */
let modifyStoreDataForQr = true;

// // ---------------------------------------------------------------------
// //  Utility Conversion
// // ---------------------------------------------------------------------

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
const isHex = str =>
  /* @__PURE__ */ new RegExp('^[0-9A-Fa-f]+$').test(str);

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

const requireElementById = (/** @type {string} */ id) => {
  const el = document.getElementById(id);
  if (!el) {
    const msg = 'HTML element not found: ' + id;
    alert(msg);
    throw new Error(msg);
  }
  return el;
};

// // ---------------------------------------------------------------------
// //  CRC-16 and CRC-32
// // ---------------------------------------------------------------------

/** Polynomial for CRC-16/CCITT. */
// const CRC16_CCITT_POLY = 0x1021;

/**
 * Calculates the CRC-16/CCITT/XMODEM checksum for the specified input data.
 * Courtesy of Luciano Barcaro: https://stackoverflow.com/a/30357446
 * @param {ArrayLike<number>} data - The data to create a checksum of.
 * @param {number} [length] - The amount of bytes in `input` to calculate.
 * @param {number} [current] - The starting CRC value, defaulting to 0.
 * @returns {number} The calculated CRC-16 checksum.
 */
function crc16(data, length = data.length, current = 0x0000) {
  const crc = current;
  let msb = crc >> 8;
  let lsb = crc & 0xFF;

  for (let i = 0; i < length; i++) {
    const c = data[i];
    let x = c ^ msb;
    x ^= (x >> 4);
    msb = (lsb ^ (x >> 3) ^ (x << 4)) & 0xFF;
    lsb = (x ^ (x << 5)) & 0xFF;
  }

  return (msb << 8) | lsb;
}

/** Polynomial for CRC-32/POSIX/CKSUM. */
const CRC32_CKSUM_POLY = 0x04C11DB7;

/**
 * Function to generate a CRC-32/POSIX/CKSUM table.
 * @param {Uint32Array} table - The Uint32Array to populate with the table.
 * @param {number} [poly] - The polynomial to generate the CRC-32 table with.
 */
function generateCrc32Table(table, poly = CRC32_CKSUM_POLY) {
  for (let i = 0; i < 256; i++) {
    let crc = i << 24;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x80000000
        ? (crc << 1) ^ poly
        : crc << 1;
    }
    table[i] = crc >>> 0; // Ensure the value is an unsigned 32-bit integer
  }
}

/** Table for CRC-32 lookup. */
const crc32CksumTable = /* @__PURE__ */ new Uint32Array(256);
generateCrc32Table(crc32CksumTable); // Generate the table.

/**
 * Calculates a checksum of `data` using CRC-32/POSIX/CKSUM.
 * @param {ArrayLike<number>} input - The data to create a checksum of.
 * @param {number} length - The amount of bytes in `input` to calculate.
 * @param {Uint32Array} [table] - The CRC-32 table to use.
 * @returns {number} The CRC-32 checksum.
 */
function crc32(input, length = input.length, table = crc32CksumTable) {
  let crc = 0x00000000;
  for (let i = 0; i < length; i++) {
    const byte = (input[i] ^ (crc >>> 24)) & 0xFF;
    crc = (table[byte] ^ (crc << 8)) >>> 0;
  }
  // XOR with 0xFFFFFFFF at the end and ensure it's unsigned
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

class StoreDataUtility {
  /**
   * Calculates the CRC-16 checksum for StoreData.
   * @param {Uint8Array} storeData - The data to calculate the checksum for.
   * @returns {number} The CRC-16 checksum.
   */
  static getCrc = storeData =>
    crc16(storeData.subarray(0, VER3_STORE_DATA_LENGTH - 2));

  /**
   * Updates the CRC-16 checksum in StoreData.
   * @param {Uint8Array} storeData - The data to update the checksum for.
   */
  static updateCrc(storeData) {
    const crc = StoreDataUtility.getCrc(storeData);
    new DataView(storeData.buffer)
      // Store as big-endian.
      .setUint16(VER3_STORE_DATA_LENGTH - 2, crc, false);
  }

  /**
   * Verifies the CRC-16 checksum in StoreData.
   * @param {Uint8Array} storeData - The data to verify the checksum for.
   * @returns {boolean} Returns true if the checksum matches.
   */
  static verifyCrc(storeData) {
    // Get the real CRC-16 checksum.
    const crcExpected = StoreDataUtility.getCrc(storeData);
    // Get the CRC-16 in the data and verify against it.
    const crcActual = new DataView(storeData.buffer)
      .getUint16(VER3_STORE_DATA_LENGTH - 2, false);
    return crcExpected === crcActual;
  }

  /**
   * Modifies the StoreData to work when scanned as a QR code on a 3DS.
   * Sets birthPlatform to 3 (needed on 3DS), and enables copying.
   * @param {Uint8Array} storeData - The Mii StoreData to modify.
   */
  static modifyForQrCode(storeData) {
    // Mii data created on Wii U, Miitomo, and Switch
    // have birthPlatform set to 4 (= Wii U). That data is
    // not scannable as a QR code on 3DS because it will
    // fail verification if birthPlatform > 3.
    // Set birthPlatform bitfield to 3 (CFLi_BIRTH_PLATFORM_CTR)
    storeData[3] = storeData[3] & 0b10001111 | 0b00110000;
    // Allow the Mii to be copied, for convenience.
    storeData[1] |= 1; // copyable = 1
  }
}

// // ---------------------------------------------------------------------
// //  AES-CTR Encryption
// // ---------------------------------------------------------------------

class TomoExtraData {
  /** @private */
  static AesCtrKeyBytes = /* @__PURE__ */ new Uint8Array([0x30, 0x81, 0x9F,
    0x30, 0x0D, 0x06, 0x09, 0x2A, 0x86, 0x48, 0x86, 0xF7, 0x0D, 0x01, 0x01, 0x01]);

  /** @private */
  static AesKey = sc.importKey('raw', TomoExtraData.AesCtrKeyBytes,
    { name: 'AES-CTR' }, false, ['decrypt', 'encrypt']);

  static decrypt = async (/** @type {Uint8Array<ArrayBuffer>} */ data,
    /** @type {AesCtrParams["counter"]} */ iv) =>
    new Uint8Array(await sc.decrypt(
      { name: 'AES-CTR', counter: iv, length: 128 },
      await TomoExtraData.AesKey, data));

  static encrypt = async (/** @type {BufferSource} */ data,
    /** @type {Uint8Array<ArrayBuffer>} */ iv = crpyto.getRandomValues(new Uint8Array(16))) => ({
    iv, encrypted: new Uint8Array(await sc.encrypt({ name: 'AES-CTR', counter: iv, length: 128 },
      await TomoExtraData.AesKey, data))
  });

  /**
   * Encrypts and appends extra data using AES-CTR and CRC-32
   * at the end of the wrapped StoreData for use in a QR code
   * for Tomodachi Life/Miitomo/Miitopia.
   *
   * The input `encryptedBytes` must already be encrypted and
   * fit the extra data + 4 (CRC-32) + 16 (IV).
   * @param {Uint8Array<ArrayBuffer>} encryptedBytes - The wrapped StoreData,
   * which the extra data will be appended at the end of.
   * @param {Uint8Array} extraData - The extra data.
   */
  static async encryptToWrappedData(encryptedBytes, extraData) {
    encryptedBytes.set(extraData, WrappedMiiDataSjcl.WrappedLength); // Append decrypted extra data.
    // Calculate CRC-32 from ENCRYPTED/wrapped data + DECRYPTED extra data.
    const lenForCrc = WrappedMiiDataSjcl.WrappedLength + extraData.length;
    // console.debug('data into crc32:', bytesToHexSpaced(dataForCrc));
    const crc = crc32(encryptedBytes, lenForCrc);
    // const crcBytes = [crc & 0xff, (crc >> 8) & 0xff, (crc >> 16) & 0xff, (crc >> 24) & 0xff];
    // console.debug('crc32: ', bytesToHexSpaced(crcBytes));

    // Write CRC-32 as an unsigned 32-bit little-endian integer.
    const totalOffsetCrc = WrappedMiiDataSjcl.WrappedLength + extraData.length;
    new DataView(encryptedBytes.buffer).setUint32(totalOffsetCrc, crc, true);
    // new DataView(extraWithCrc.buffer).setUint32(extraData.length, crc, true);
    const extraWithCrc = encryptedBytes.subarray(
      WrappedMiiDataSjcl.WrappedLength, totalOffsetCrc + 4);

    // Get randomly generated IV and ciphertext as a new buffer.
    const { encrypted: encryptedExtra, iv } = await TomoExtraData.encrypt(extraWithCrc);

    // Copy the IV first, then the encrypted data, after the main QR data.
    encryptedBytes.set(iv, WrappedMiiDataSjcl.WrappedLength);
    encryptedBytes.set(encryptedExtra, WrappedMiiDataSjcl.WrappedLength + 16); // 16 = IV length.
  }

  /**
   * Decodes extra data in the QR code (must be present) and displays in the hex editor.
   * @param {Uint8Array<ArrayBuffer>} encryptedBytes - The encrypted QR code data.
   * @returns {Promise<Uint8Array|null>}
   */
  static async decryptFromWrappedData(encryptedBytes) {
    const ivOffset = WrappedMiiDataSjcl.WrappedLength + 16;
    /** Take the 128 bit IV. */
    const iv = encryptedBytes.subarray(WrappedMiiDataSjcl.WrappedLength, ivOffset);
    /** This is the full ciphertext. Last 4 bytes are the CRC-32. */
    const encryptedExtra = encryptedBytes.subarray(ivOffset);

    const decryptedExtra = await TomoExtraData.decrypt(encryptedExtra, iv);
    // If decryption succeeded, slice off the CRC-32 in the data and load that.
    const CRC32_SIZE = 4;
    const decryptedExtraData = decryptedExtra.subarray(0, -CRC32_SIZE);

    const crcOffset = decryptedExtra.length - CRC32_SIZE;
    /** Actual CRC-32 in the data. */
    const crcActual = new DataView(decryptedExtra.buffer).getUint32(crcOffset, true);

    // Verify the CRC-32 checksum, which verifies against the
    // encrypted (wrapped) StoreData with the decrypted extra data.

    // Copy encryptedBytes array and set decrypted extra data within it.
    const encryptedForCrc = new Uint8Array(encryptedBytes);
    encryptedForCrc.set(decryptedExtraData, WrappedMiiDataSjcl.WrappedLength);
    const offsetForCrc = WrappedMiiDataSjcl.WrappedLength + decryptedExtraData.length;
    const dataForCrc = encryptedForCrc.subarray(0, offsetForCrc);
    /** Calculated CRC-32 from the real data. */
    const crcExpected = crc32(dataForCrc);
    if (crcExpected !== crcActual) {
      return null;
    }

    // CRC matches, load into output.
    return decryptedExtraData;
  }

  /**
   * @param {number} length - The length of the extra data.
   * @returns {string} A generic name that can be used in a filename to describe the extra data.
   */
  static getDataName(length) {
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

  static hasExtra(/** @type {number} */ encryptedLength) {
    const extraLength = encryptedLength - WrappedMiiDataSjcl.WrappedLength - 16 - 4;
    // return extraLength > 0;
    return TomoExtraData.getDataName(extraLength) !== 'data';
  }
}

const getQrCodePng = (/** @type {ArrayLike<number>} */ data) =>
  // 112 byte WrappedMiiData QR codes are version 10 and have high error correction.
  // Matches the original QR code images 1:1.
  // QRCode.generatePNG(encryptedBytes, { margin: 0, modulesize: 2, ecclevel: 'H' });
  QRCode.generatePNG(data, { margin: null, ecclevel: 'H' });

// // ---------------------------------------------------------------------
// //  QR Code Creation and Scanning
// // ---------------------------------------------------------------------

// These functions are meant to be used completely inline within
// the sample and weren't written to be reused at all...

const qrCodeContainer = /** @type {HTMLDivElement} */ (requireElementById('qr-code-container'));

const extraDataWarning = requireElementById('extra-data-warning');
const extraDataWarningInner = requireElementById('extra-data-warning-inner');

const storeDataWarning = requireElementById('storedata-warning');
const storeDataWarningInner = requireElementById('storedata-warning-inner');

/**
 * Generates a QR code of the data.
 * @param {Uint8Array} [storeData] - Input StoreData.
 * @param {Uint8Array} [extraData] - Input extra data.
 * @returns {Promise<void>} The code is emitted to HTML ID "qr-code-container".
 * @throws {Error} Throws if "qr-code-container" element does not exist, or StoreData is empty.
 */
async function generateQrCode(storeData = hexEditorBaseInput.saveToArray(),
  extraData = hexEditorExtraInput.saveToArray()) {
  if (storeData.length <= 0) {
    alert(`Please upload or enter Mii StoreData.
If you don't have any, try pasting this: ${jasmineStoreData}`);
    return;
  }

  if (modifyStoreDataForQr) {
    // Modify the data to allow copying and scanning on 3DS.
    StoreDataUtility.modifyForQrCode(storeData);
    // Update the CRC-16 in the data.
    StoreDataUtility.updateCrc(storeData);
  }

  /** The additional length used by extra data in the QR code. */
  const encryptedLength = (extraData.length > 0)
    ? WrappedMiiDataSjcl.WrappedLength + (extraData.length + 4 + 16) // Add CRC-32 and IV.
    : WrappedMiiDataSjcl.WrappedLength;
  // Create buffer to store encrypted data and extra data.
  const encryptedBytes = new Uint8Array(encryptedLength);

  // Create encrypted/"wrapped" data to put in the QR code.
  WrappedMiiDataSjcl.encrypt(encryptedBytes, storeData, aesCcmKeyPrimary);

  console.debug('qr data (WrappedMiiData):', bytesToHexSpaced(encryptedBytes));
  if (extraData.length > 0) {
    // Append extra data if present.
    await TomoExtraData.encryptToWrappedData(encryptedBytes, extraData);
  }
  console.debug('final encrypted qr data', bytesToHexSpaced(encryptedBytes));

  if (!qrCodeContainer || !(qrCodeContainer.firstElementChild instanceof HTMLImageElement)) {
    throw new Error('generateQrCode: Element qr-code-container or its child is not an image.');
  }

  const qrImg = /** @type {HTMLImageElement} */ (qrCodeContainer.firstElementChild);
  qrImg.src = getQrCodePng(encryptedBytes);
}

/**
 * The callback for the scanned QR code data from QrScanner.
 * @param {QrScanner.ScanResult & {binaryData: Uint8Array}} result - The result object received from QrScanner.
 * @throws {Error} Throws if scanned length is 0.
 */
async function handleQrCode(result) {
  if (!result) {
    console.warn('handleQrCode: result was falsy.');
    return;
  } else if (!result.binaryData) {
    console.warn('handleQrCode: result.binaryData was falsy.');
    return;
  }

  // Stop the scanner if the result is good.
  cameraScanner.stop();

  const bytes = result.binaryData;
  if (!bytes.length) { // Length is falsy.
    throw new Error(`handleQrCode: Scanned QR code data has byte length of ${bytes.length}.`);
  }
  // Scan was successful. Reset warnings.
  storeDataWarning.style.display = 'none';
  extraDataWarning.style.display = 'none';

  const encryptedBytes = new Uint8Array(bytes);

  const decryptedData = new Uint8Array(VER3_STORE_DATA_LENGTH);
  /** Decrypt the first AES-CCM encrypted portion. */
  WrappedMiiDataSjcl.decrypt(decryptedData, encryptedBytes.subarray(0,
    WrappedMiiDataSjcl.WrappedLength), aesCcmKeyPrimary);
  // Show an error message if the CRC-16 checksum does not match.
  if (!StoreDataUtility.verifyCrc(decryptedData)) {
    storeDataWarning.style.display = 'initial';
    storeDataWarningInner.textContent = 'CRC-16 checksum does not match. The data below is probably invalid.';
  }

  hexEditorBaseOutput.loadFromArray(decryptedData);

  // Check if the encrypted extra data is truly present.
  if (!TomoExtraData.hasExtra(encryptedBytes.length)) {
    hexEditorExtraOutput.container.style.display = 'none';
    return;
  }

  const extraResult = await TomoExtraData.decryptFromWrappedData(encryptedBytes);

  if (extraResult) {
    hexEditorExtraOutput.loadFromArray(extraResult);
    hexEditorExtraOutput.container.style.display = '';
  } else {
    extraDataWarning.style.display = 'initial';
    extraDataWarningInner.textContent = 'CRC-32 checksum in extra data does not match. Loading data as-is without decryption.';
    /** Extra data without decryption. */
    const extra = encryptedBytes.subarray(WrappedMiiDataSjcl.WrappedLength);
    hexEditorExtraOutput.loadFromArray(extra);
    hexEditorExtraOutput.container.style.display = '';
  }
}

// // ---------------------------------------------------------------------
// //  Utilities used when downloading data
// // ---------------------------------------------------------------------

const getStringUtf16Le = (/** @type {Uint8Array} */ bytes) =>
  // Null-terminate the string by splitting it like this.
  new TextDecoder('utf-16le').decode(bytes).split('\0')[0];

const getNameFromStoreData = (/** @type {Uint8Array} */ ver3StoreData) =>
  getStringUtf16Le(ver3StoreData.subarray(0x1A, 0x1A + 20));

/**
 * @param {Date} [d] - The date to format.
 * @returns {string} The current time in a format that can be included in a file name.
 */
const getFormattedTime = (d = new Date()) => `${d.getFullYear()}-` +
  `${String(d.getMonth() + 1).padStart(2, '0')}-` +
  `${String(d.getDate()).padStart(2, '0')}_` +
  `${String(d.getHours()).padStart(2, '0')}-` +
  `${String(d.getMinutes()).padStart(2, '0')}-` +
  `${String(d.getSeconds()).padStart(2, '0')}`;

// // ---------------------------------------------------------------------
// //  Helpers for Downloading Data
// // ---------------------------------------------------------------------

/**
 * General function to download any data as a file.
 * It will create a blob of the data, then make an anchor
 * element with the blob link and click on it.
 * @param {Uint8Array<ArrayBuffer>} data - The data to download.
 * @param {string} filename - The filename that the file should appear with.
 * @param {string} [mimeType] - The MIME type for the file to download.
 */
function downloadData(data, filename, mimeType = 'application/octet-stream') {
  if (data.length <= 0) {
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
 * @param {Uint8Array<ArrayBuffer>} [data] - The StoreData to download.
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
 * @param {Uint8Array<ArrayBuffer>} [extraData] - The extra data to download.
 * @param {Uint8Array<ArrayBuffer>} [storeData] - The StoreData associated, to resolve a name.
 */
function downloadExtraData(extraData = hexEditorExtraOutput.saveToArray(),
  storeData = hexEditorBaseOutput.saveToArray()) {
  /** Extracted name from StoreData, or timestamp. */
  let prefix = '';
  if (!storeData || !(prefix = getNameFromStoreData(storeData))) {
    prefix = getFormattedTime();
  } // use in place of name

  let fileBaseName = TomoExtraData.getDataName(extraData.length);
  if (!fileBaseName) {
    fileBaseName = 'extra-mii-qr-data';
  }
  fileBaseName = prefix + '-' + fileBaseName;
  downloadData(extraData, fileBaseName + '.bin');
}

/** Clears the extra data input. */
function clearExtraData() {
  hexEditorExtraInput.clearData();
  /** @type {HTMLInputElement} */ (requireElementById('load-extra-btn')).value = '';
}

// // ---------------------------------------------------------------------
// //  Helpers for Uploading Data
// // ---------------------------------------------------------------------

/**
 * Function to load StoreData from file.
 * @param {Event} event - The upload event.
 */
async function loadStoreDataFromFile(event) {
  const files = /** @type {HTMLInputElement} */ (event.target).files;
  if (!files || !files[0]) {
    return;
  }

  const fileSize = files[0].size;
  if (fileSize !== VER3_STORE_DATA_LENGTH) {
    alert(`StoreData (.cfsd/.ffsd) file must be exactly ${VER3_STORE_DATA_LENGTH} bytes long.`);
    return;
  }

  const result = await files[0].arrayBuffer();
  const baseData = new Uint8Array(result);

  // Load into the hex editor for base data (StoreData)
  hexEditorBaseInput.loadFromArray(baseData);
}

/**
 * Function to load extra data from file.
 * @param {Event} event - The upload event.
 */
async function loadExtraDataFromFile(event) {
  const files = /** @type {HTMLInputElement} */ (event.target).files;
  if (!files || !files[0]) {
    return;
  }

  const result = await files[0].arrayBuffer();
  const extraData = new Uint8Array(result);

  // Load into the hex editor for extra data
  hexEditorExtraInput.loadFromArray(extraData);
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
      if (isHex(pasteData)) {
      // Process valid hex normally
        hexEditorInstance.textArea.value = pasteData.replace(/(.{2})/g, '$1 ').trim();
      } else {
        if (isBase64(pasteData)) {
        // Decode base64 and load as hex into the HexEditor
          const decodedBase64 = base64ToBytes(pasteData);
          hexEditorInstance.loadFromArray(decodedBase64);
        } else {
          alert('Invalid hex or base64 data.');
        }
      }

      hexEditorInstance.textArea.dispatchEvent(new Event('input'));
    });
}

/** @type {QrScanner} */
let cameraScanner;

const camList = /** @type {HTMLSelectElement} */ (requireElementById('cam-list'));

const startCameraButton = /** @type {HTMLButtonElement} */ (requireElementById('start-camera'));
const stopCameraButton = /** @type {HTMLButtonElement} */ (requireElementById('stop-camera'));

// Initialize hex editors for the inputs and outputs
/** @type {HexEditor} */ let hexEditorBaseInput;
/** @type {HexEditor} */ let hexEditorExtraInput;
/** @type {HexEditor} */ let hexEditorBaseOutput;
/** @type {HexEditor} */ let hexEditorExtraOutput;

document.addEventListener('DOMContentLoaded', () => {
  hexEditorBaseInput = new HexEditor(requireElementById('hex-editor-storedata'), false);

  setupHexEditorPasteHandling(hexEditorBaseInput); // Attach paste handling to this instance

  hexEditorExtraInput = new HexEditor(requireElementById('hex-editor-extra'), false);
  hexEditorBaseOutput = new HexEditor(requireElementById('hex-editor-decrypt-storedata'), true);
  hexEditorExtraOutput = new HexEditor(requireElementById('hex-editor-decrypt-extra'), true);

  const qrVideo = /** @type {HTMLVideoElement} */ (requireElementById('qr-video'));

  // QR Code Scanner for decoding
  cameraScanner = new QrScanner(qrVideo,
    handleQrCode, {
      highlightScanRegion: true,
      highlightCodeOutline: true
    });

  // // ---------------------------------------------------------------------
  // //  Event Listeners
  // // ---------------------------------------------------------------------

  /** @type {HTMLButtonElement} */ (requireElementById('generate-qr-code'))
    .addEventListener('click', () => {
      generateQrCode();
    });
  /** @type {HTMLButtonElement} */ (requireElementById('download-store-data'))
    .addEventListener('click', () => {
      downloadStoreData();
    });
  /** @type {HTMLButtonElement} */ (requireElementById('download-extra-data'))
    .addEventListener('click', () => {
      downloadExtraData();
    });
  /** @type {HTMLButtonElement} */ (requireElementById('clear-extra-data'))
    .addEventListener('click', () => {
      clearExtraData();
    });
  /** @type {HTMLInputElement} */ (requireElementById('load-storedata-btn'))
    .addEventListener('change', loadStoreDataFromFile);
  /** @type {HTMLInputElement} */ (requireElementById('load-extra-btn'))
    .addEventListener('change', loadExtraDataFromFile);

  startCameraButton.addEventListener('click', () => {
    cameraScanner.start().then(() => {
      // List cameras after the scanner started to avoid listCamera's stream and the scanner's stream being requested
      // at the same time which can result in listCamera's unconstrained stream also being offered to the scanner.
      // Note that we can also start the scanner after listCameras, we just have it this way around in the demo to
      // start the scanner earlier.
      const existingCameras = document.getElementsByClassName('device-camera');
      for (const camera of existingCameras) {
        // go ahead and remove all existing cameras to repopulate camera list
        camera.remove();
      }
      /** @type {Promise<Array<{id: string, label: string}>>} */ (QrScanner.listCameras(true)).then(
        (cameras) => {
          for (const camera of cameras) {
            const option = document.createElement('option');
            option.value = camera.id;
            option.text = camera.label;
            option.className = 'device-camera';
            camList.add(option);
          }
        });
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

  /** @type {HTMLInputElement} */ (requireElementById('file-input')).addEventListener('change', (event) => {
    const files = /** @type {HTMLInputElement} */ (event.target).files;
    if (files && files[0]) {
      QrScanner.scanImage(files[0], { returnDetailedScanResult: true })
        .then(handleQrCode);
    }
  });

  /** @type {HTMLInputElement} */ (requireElementById('key-type')).addEventListener('change', (event) => {
    const type = /** @type {HTMLInputElement} */ (event.target).value;
    const newKey = AES_CCM_KEYSLOT_0x31_KEYS[Number(type)];
    aesCcmKeyPrimary = newKey;
    console.debug('key changed to: ' + aesCcmKeyPrimary);
  });

  /** @type {HTMLInputElement} */ (requireElementById('qr-modify-storedata')).addEventListener('change', (event) => {
    const enable = /** @type {HTMLInputElement} */ (event.target).checked;
    console.debug('modify storedata for qr:', enable);
    modifyStoreDataForQr = enable;
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

//ex/port {
//  TomoExtraData, WrappedMiiDataSjcl, generateQrCode,
//  downloadStoreData, downloadExtraData,
//  loadStoreDataFromFile, loadExtraDataFromFile
//};