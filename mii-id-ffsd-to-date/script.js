const messageElements = document.querySelectorAll('.message');

function showMessage(messageId) {
    messageElements.forEach(el => el.style.display = 'none');
    document.getElementById(messageId).style.display = 'initial';
}

function toggleCharacter(happy) {
    document.getElementById('character-normal').style.display = happy ? 'initial' : 'none';
    document.getElementById('character-sad').style.display = happy ? 'none' : 'initial';
}

// Updated byte conversion utilities
const stripSpaces = str => str.replace(/\s+/g, '');

const hexToUint8Array = hex => 
new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

const base64ToUint8Array = base64 => {
    const normalizedBase64 = base64.replace(/-/g, '+').replace(/_/g, '/');
    const paddedBase64 = normalizedBase64.padEnd(normalizedBase64.length + (4 - (normalizedBase64.length % 4)) % 4, '=');
    return Uint8Array.from(atob(paddedBase64), c => c.charCodeAt(0));
};

const uint8ArrayToHex = uint8Array =>
Array.from(uint8Array).map(byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();

const parseHexOrB64TextStringToUint8Array = text => {
    const cleanedData = stripSpaces(text);
    return /^[0-9a-fA-F]+$/.test(cleanedData) ? hexToUint8Array(cleanedData) : base64ToUint8Array(cleanedData);
};

function formatMacAddress(input) {
    // Convert Uint8Array to hex if needed
    const hexArray = typeof input === "string"
        ? input.match(/.{1,2}/g) // Split string into pairs
        : Array.from(input).map(byte => byte.toString(16).padStart(2, '0')); // Format Uint8Array to hex

    return hexArray.join(':').toUpperCase();
}

// Centralized Mii data table with fixed extraction
const miiDataTable = [
    {
        lengths: [72, 92, 96],
        version: 3,
        extractCreateID: (data) => data.slice(12, 22)
    },
    {
        lengths: [74, 76],
        version: 1,
        extractCreateID: (data) => data.slice(24, 34)
    },
    {
        lengths: [88, 46],
        version: 4,
        sad: true
    },
    {
        lengths: [47, 48],
        messageId: "message-studio",
        sad: true
    },
    {
        lengths: [104, 106, 108],
        messageId: "message-miic",
        sad: true
    }
];

// Version-specific parsing logic for CreateID
const createIDParsers = {
    1: (createIDBytes) => {
        const flags = createIDBytes[0] >>> 4;
        const base = createIDBytes.slice(-6);
        const dateOffsetBytes = createIDBytes.slice(0, 4);

        // Set the first four bits to zero
        dateOffsetBytes[0] &= 0x0F;
        const dateOffset = parseInt(uint8ArrayToHex(dateOffsetBytes), 16) * 2;

        const epoch = new Date('2006-01-01T00:00:00Z').getTime() / 1000;
        const creationDate = new Date((epoch + dateOffset) * 1000);

        return {
            flag: flags,
            base: uint8ArrayToHex(base),
            epoch: epoch,
            dateOffset: dateOffset,
            date: creationDate
        };
    },

    3: (createIDBytes) => {
        const flags = createIDBytes[0] >>> 4;
        const base = createIDBytes.slice(-6);
        const dateOffsetBytes = createIDBytes.slice(0, 4);

        // Set the first four bits to zero
        dateOffsetBytes[0] &= 0x0F;
        const dateOffset = parseInt(uint8ArrayToHex(dateOffsetBytes), 16) * 2;

        const epoch = new Date('2010-01-01T00:00:00Z').getTime() / 1000;
        const creationDate = new Date((epoch + dateOffset) * 1000);

        return {
            flag: flags,
            base: uint8ArrayToHex(base),
            epoch: epoch,
            dateOffset: dateOffset,
            date: creationDate
        };
    }
};

function analyzeData(data) {
    const dataBytes = parseHexOrB64TextStringToUint8Array(data);
    for (const entry of miiDataTable) {
        if (entry.lengths.includes(dataBytes.length)) {
            if (entry.version === undefined) {
                showMessage(entry.messageId);
                toggleCharacter(!entry.sad);
                return;
            }
            if (entry.extractCreateID !== undefined) {
                const createIDBytes = entry.extractCreateID(dataBytes);
                const createIDObject = createIDParsers[entry.version](createIDBytes);

                // Displaying parsed data dynamically
                document.getElementById(`createid-result-v${entry.version}`).textContent = uint8ArrayToHex(createIDBytes);
                //document.getElementById(`createid-flags-v${entry.version}`).textContent = uint8ArrayToHex(createIDObject.flag);
                document.getElementById(`createid-base-v${entry.version}`).textContent = formatMacAddress(createIDObject.base);
                document.getElementById(`createid-date-v${entry.version}`).textContent = createIDObject.date.toUTCString();
            }

            showMessage(`message-version-${entry.version}`);
            toggleCharacter(!entry.sad);
            return;
        }
    }
    showMessage('message-invalid');
    toggleCharacter(false);
}

document.getElementById('data-form').onsubmit = function (event) {
    event.preventDefault();
    const input = document.getElementById('data-input').value.trim();
    try {
        analyzeData(input);
    } catch (e) {
        showMessage('message-exception');
        toggleCharacter(false);
        document.getElementById('exception-message').textContent = e.message;
    }
};