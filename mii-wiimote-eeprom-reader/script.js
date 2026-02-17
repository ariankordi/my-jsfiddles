// @ts-check

// Hex Editor

/** A hex editor class for displaying and editing hex data within a container. */
class HexEditor {
  /**
   * Creates an instance of HexEditor.
   * @param {HTMLElement|null} container - The container element that holds the hex editor components.
   * @param {boolean} [isReadOnly] - Determines if the hex editor should be read-only.
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
      throw new Error('HexEditor: Missing or invalid .hex-textarea element.');
    }
    this.textArea = textArea;

    /**
     * Element for storing line numbers.
     * @type {HTMLElement|null}
     */
    const lineNumbers = container.querySelector('.line-numbers');
    if (!(lineNumbers instanceof HTMLElement)) {
      throw new Error('HexEditor: Missing or invalid .line-numbers element.');
    }
    this.lineNumbers = lineNumbers;

    /**
     * Element for ASCII/Unicode output.
     * @type {HTMLElement|null}
     */
    const asciiOutput = container.querySelector('.ascii-output');
    if (!(asciiOutput instanceof HTMLElement)) {
      throw new Error('HexEditor: Missing or invalid .ascii-output element.');
    }
    this.asciiOutput = asciiOutput;

    /**
     * Hex header element (00, 01, 02...)
     * @type {HTMLElement|null}
     */
    const header = container.querySelector('.table-padding');
    if (!(header instanceof HTMLElement)) {
      throw new Error('HexEditor: Missing or invalid .table-padding element.');
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
      .substring(0, caretPosition) // Get the substring before the caret
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
        const charCode = parseInt(cleanHex.substring(i, i + 2), 16);
        // Add valid character or dot.
        asciiString += (32 < charCode && charCode < 127)
          ? String.fromCharCode(charCode)
          : '.';
      }
    } else {
      // UTF-16 encoding mode (handles both LE and BE)
      for (let i = 0; i < cleanHex.length; i += 6) { // Read every two bytes for UTF-16
        const byte1 = parseInt(cleanHex.substring(i, i + 2), 16);
        const byte2 = parseInt(cleanHex.substring(i + 3, i + 5), 16);
        let charCode;

        // Handle little-endian or big-endian decoding
        if (this.encodingMode === 'utf16le') {
          charCode = (byte2 << 8) + byte1; // Little-endian: lower byte first
        } else {
          charCode = (byte1 << 8) + byte2; // Big-endian: higher byte first
        }

        // Skip control characters and null bytes (0x00)
        if (charCode !== 0 && charCode >= 32) { // Skip non-printable characters
          asciiString += String.fromCharCode(charCode); // Add valid Unicode character
        } else {
          asciiString += '.'; // Replace non-printable characters with a dot
        }
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
    uint8Array.forEach((byte) => {
      // Convert each byte to hex string and append.
      hexString += (0 + byte.toString(16)).slice(-2) + ' '; // Trigger input event to update the editor
    });
    this.textArea.value = hexString.trim(); // Set textarea value with the hex string
    this.textArea.dispatchEvent(new Event('input'));
  }

  /**
   * Saves the current hex data from the text area into a Uint8Array.
   * @returns {Uint8Array} The Uint8Array containing the hex data.
   */
  saveToArray() {
    /** Cleaned hex string. */
    const cleanHex = this.cleanHexInput(this.textArea.selectionStart).replace(/ /g, '');
    /** Uint8Array to hold the hex data. */
    const byteArray = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < cleanHex.length; i += 2) {
      byteArray[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16); // Convert hex to bytes
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
  escapeHtml(unsafe) {
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

    const highlightedText = asciiContent.substring(adjustedStart, adjustedEnd);

    const preText = asciiContent.substring(0, adjustedStart);
    const postText = asciiContent.substring(adjustedEnd);

    // Rebuild the ASCII content with the highlighted selection
    this.asciiOutput.innerHTML = `${this.escapeHtml(preText)}<mark>${this.escapeHtml(highlightedText)}</mark>${this.escapeHtml(postText)}`;
  }

  /** Clears any highlights in the ASCII/Unicode view. */
  clearHexHighlights() {
    // Remove all <mark> tags.
    this.asciiOutput.innerHTML = this.asciiOutput.innerHTML
      .replace(/<mark>/g, '')
      .replace(/<\/mark>/g, '');
  }
}

// End Hex Editor

// Originally modified from: https://github.com/murkle/utils/blob/master/webhid/nintendo_wiimote.html

const deviceFilter = [{
  // Product name 'Nintendo RVL-CNT-01'
  vendorId: 0x057E,
  productId: 0x0306
}];
const requestParams = {
  filters: deviceFilter
};

const hid = /** @type {HID} */ (navigator.hid);

// ---------- Constants & helpers ----------

// Report IDs (see Wiibrew docs)
/** (a2) host → Wiimote */
const REPORT_MEM_READ_REQ = 0x17;
/** (a1) Wiimote → host */
const REPORT_MEM_READ_RESP = 0x21;

/**
 * Build big-endian byte array for 24-bit address.
 * @param {number} n
 * @returns {Array<number>}
 */
const be24 = n => [(n >> 16) & 0xFF, (n >> 8) & 0xFF, n & 0xFF];

/**
 * Pad number to eight-bit binary (for your debug panel).
 * @param {number} num
 * @returns {string}
 */
const binary8 = num => '0b' + ('00000000' + num.toString(2)).slice(-8);

/**
 * Hex dump utility (16 bytes/row).
 * @param {Uint8Array|Array<number>} buffer
 * @returns {string}
 */
function hexDump(buffer) {
  let out = '';
  buffer.forEach((byte, i) => {
    if (i % 16 === 0) {
      out += `\n${('0000' + i.toString(16)).slice(-4)}: `;
    }
    out += ('0' + byte.toString(16)).slice(-2) + ' ';
  });
  return out;
}

// ---------- UI elements ----------
const messageElement = /** @type {HTMLDivElement} */ (document.getElementById('message'));
const deviceElement = /** @type {HTMLDivElement} */ (document.getElementById('device'));
/** add a <button id="dump">Dump EEPROM</button> */
// const dumpButton = /** @type {HTMLButtonElement} */ (document.getElementById('dump'));
const hexEditorEeprom = new HexEditor(document.getElementById('hex-editor-eeprom'), true);

// ---------- Global state ----------
/** Active EEPROM transfer bookkeeping. */
let currentDump = {
  targetBytes: 0,
  received: /** @type {number[]} */ ([]),
  inProgress: false
};

// ---------- Core logic ----------

/**
 * Start an EEPROM read and prepare to collect chunks.
 * @param {HIDDevice} device
 * @param {number} offset - 0x0000–0x16FF
 * @param {number} length - 1–0x1700
 */
function readEEPROMRange(device, offset, length) {
  if (!device) {
    return;
  }

  // Build read request: MM=0x00 (EEPROM, no rumble) + 24-bit address + 16-bit length.
  const payload = new Uint8Array([
    0x00,
    ...be24(offset),
    (length >> 8) & 0xFF,
    length & 0xFF
  ]);

  currentDump = { targetBytes: length, received: [], inProgress: true };

  console.info(`Reading ${length} bytes from 0x${offset.toString(16)}`);

  device.sendReport(REPORT_MEM_READ_REQ, payload).catch(console.error);
}

/**
 * Handle Input Reports (buttons **or** EEPROM data).
 * @param {HIDInputReportEvent} event
 */
function handleInputReport(event) {
  const data = new Uint8Array(event.data.buffer);

  /*
  if (event.reportId === REPORT_MEM_READ_RESP) {
    // Byte layout: BB BB | SE | FF FF | 16x data
    const sizeNibble = data[2] >> 4; // high nibble = size-1
    const payloadBytes = sizeNibble + 1; // 1–16
    const payload = data.subarray(5, 5 + payloadBytes);

    if (currentDump.inProgress) {
      currentDump.received.push(...payload);

      if (currentDump.received.length >= currentDump.targetBytes) {
        currentDump.inProgress = false;
        const fullData = currentDump.received.slice(0, currentDump.targetBytes);
        console.log('EEPROM dump complete.', hexDump(fullData));
        // Expose for dev-tools tinkering or download.
        window.lastEepromDump = new Uint8Array(fullData);
      }
    }
    return; // Ignore button parsing while dumping.
  }
  */

  // --- Normal button/IMU path (unchanged) ---
  console.debug('data:', data);
  const directions = ['None', 'W', 'E', 'Impossible', 'S', 'SW', 'SE', 'Impossible', 'N', 'NW', 'NE'];
  let message = '';
  const direction = directions[data[0] & 15];
  const buttonA = !!(data[1] & 8);
  const buttonB = !!(data[1] & 4);
  const buttonPlus = !!(data[0] & 16);
  const buttonMinus = !!(data[1] & 16);
  const buttonHome = !!(data[1] & 128);
  const buttonOne = !!(data[1] & 2);
  const buttonTwo = !!(data[1] & 1);
  message += '<br/>Direction = ' + direction;
  message += '<br/>Button A = ' + buttonA;
  message += '<br/>Button B = ' + buttonB;
  message += '<br/>Button Plus = ' + buttonPlus;
  message += '<br/>Button Minus = ' + buttonMinus;
  message += '<br/>Button Home = ' + buttonHome;
  message += '<br/>Button 1 = ' + buttonOne;
  message += '<br/>Button 2 = ' + buttonTwo;
  const debug = true;
  if (debug) {
    for (let i = 0; i < 8; i++) {
      message += `<br/>data[${i}] = ${binary8(data[i])} = ${data[i]}`;
    }
  }
  messageElement.innerHTML = message;
}

/**
 * Handle physical disconnects.
 * @param {HIDConnectionEvent} event
 */
function handleDisconnectedDevice(event) {
  console.warn(`Device disconnected: ${event.device.productName}`);
  messageElement.innerHTML = 'Device disconnected.';
}

hid.addEventListener('disconnect', handleDisconnectedDevice);

/**
 * Sends report 0x12 to configure the data reporting mode.
 * Reference: https://github.com/PicchiKevin/wiimote-webhid/blob/main/src/const.js#L4
 * https://github.com/PicchiKevin/wiimote-webhid/blob/dd72f846159020d1dac665b29913b5bb34dd3e0c/src/wiimote.js#L145
 * @param {HIDDevice} device
 * @param {number} mode  e.g. 0x30 for CORE_BUTTONS
 */
function setDataReportingMode(device, mode) {
  // Byte 0: Rumble (0x00 = off), Byte 1: Mode
  const payload = new Uint8Array([0x00, mode]);
  return device.sendReport(0x12, payload)
    .then(() => console.info(`Data reporting mode set to 0x${mode.toString(16)}`))
    .catch(console.error);
}

/**
 * Request a memory read from the Wii Remote EEPROM.
 * @param {HIDDevice} device
 * @param {number} offset - Start address (0x0000 to 0x16FF)
 * @param {number} length - Total bytes to read (<= 0x1700)
 * @returns {Promise<Uint8Array>}
 */
function readEEPROMRange2(device, offset, length) {
  return new Promise((resolve, reject) => {
    if (!device) return reject(new Error("Device not connected"));

    const REPORT_MEM_READ_REQ = 0x17;
    const REPORT_MEM_READ_RESP = 0x21;

    const payload = new Uint8Array([
      0x00, // MM = no rumble, EEPROM
      ...be24(offset),
      (length >> 8) & 0xff,
      length & 0xff
    ]);

    /** @type {Array<number>} */ const chunks = []; // TODO PRE ALLOCATE
    let received = 0;

    /** @param {HIDInputReportEvent} event */
    function onReport(event) {
      if (event.reportId !== REPORT_MEM_READ_RESP) return;

      const data = new Uint8Array(event.data.buffer);
      const size = (data[2] >> 4) + 1; // SE high nibble + 1
      const chunk = data.slice(5, 5 + size);

      chunks.push(...chunk);
      received += chunk.length;

      if (received >= length) {
        device.removeEventListener("inputreport", onReport);
        resolve(new Uint8Array(chunks.slice(0, length)));
      }
    }

    device.addEventListener("inputreport", onReport);

    device.sendReport(REPORT_MEM_READ_REQ, payload).catch((err) => {
      device.removeEventListener("inputreport", onReport);
      reject(err);
    });
  });
}

/**
 * Initialize the connection, set up handlers, then drain and log the full 0x1700‑byte EEPROM.
 */
async function init() {
  const devices = await hid.requestDevice(requestParams);
  if (devices.length < 1) {
    return;
  }
  const device = devices[0];

  await device.open();
  setDataReportingMode(device, 0x30); // CORE_BUTTONS

  console.info(`Opened device: ${device.productName}`, device);
  deviceElement.innerHTML = device.productName;

  // Hook up our standard button logger
  device.addEventListener('inputreport', handleInputReport);

  //readEEPROMRange(device, 0x0FCA, 0x05E0);
  const output = await readEEPROMRange2(device, 0x0FCA, 0x05E0);
  hexEditorEeprom.loadFromArray(output);
  //readEEPROMRange(device, 0x0000, 0x16FF);
}
