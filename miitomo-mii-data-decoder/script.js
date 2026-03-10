/*
#pragma pack(push, 1)
typedef struct mii_data {
    // note that a dataset of 32463 of these scraped from kaerutomo
    // outfit/sidekick central has been used to guess constant/unused fields.
    // unused = it has never been seen as non-zero in my dataset
    uint32_t _0; // always 03000000, only LSB is used
    uint8_t _4_4:4; // unused
    uint8_t allColor:4;
    uint8_t topslongColor:4;
    uint8_t topsColor:4;
    uint8_t bottomsAColor:4;
    uint8_t bottomsBColor:4;
    uint8_t shoesColor:4;
    uint8_t accessoryColor:4;
    uint8_t headwearColor:4;
    uint8_t _8_0:4; // unk/1% of dataset
    uint8_t _9; // unk/6% of dataset
    int16_t allIndex; // bodyAll
    int16_t topslongIndex;
    int16_t topsIndex;
    int16_t bottomsAIndex;
    int16_t bottomsBIndex;
    int16_t shoesIndex;
    int16_t accessoryIndex; // bodyAcce
    int16_t headwearIndex;
    uint8_t topsState; // 02 = untucked, 01 = tucked (??), possible vals <= 4
    uint8_t voiceParam[6]; // copied to JSON
    uint8_t characterParam[5]; // copied to JSON
    uint8_t specialMiiRegion; // copied to JSON, possible vals <= 4
    uint8_t _27; // last 4 bits used 1% / first 4 unused
    int16_t _28; // first 8 bits used 5%
    int16_t _2a; // 5% used?
    int16_t _2c; // first 8 bits used 5%
    uint8_t _2e; // 5% used?
    uint8_t _2f; // last 4 bits used 1% / first 4 unused
    uint16_t _30; // unused
    int16_t birthYear; // unset=0, min. 1900, birth day/month are in StoreData(?)
} mii_data;
*/
function decodeToObject(data) {
    const readS16 = (offset) => (data[offset] | (data[offset + 1] << 8)) << 16 >> 16; // Signed 16-bit
    const readU16 = (offset) => (data[offset] | (data[offset + 1] << 8));           // Unsigned 16-bit
    const readS32 = (offset) => (data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24));
    const readU8 = (offset) => data[offset]; // Unsigned 8-bit

    return {
        _0: `0x${readS32(0).toString(16).padStart(8, '0')}`,
        //_4_4: readU8(4) & 0xf,
        allColor: readU8(4) >> 4,
        topslongColor: readU8(5) & 0xf,
        topsColor: readU8(5) >> 4,
        bottomsAColor: readU8(6) & 0xf,
        bottomsBColor: readU8(6) >> 4,
        shoesColor: readU8(7) & 0xf,
        accessoryColor: readU8(7) >> 4,
        headwearColor: readU8(8) & 0xf,
        _8_0: readU8(8) >> 4,
        _9: readU8(9),
        allIndex: readS16(10),
        topslongIndex: readS16(12),
        topsIndex: readS16(14),
        bottomsAIndex: readS16(16),
        bottomsBIndex: readS16(18),
        shoesIndex: readS16(20),
        accessoryIndex: readS16(22),
        headwearIndex: readS16(24),
        topsState: readU8(26),
        voiceParam: Array.from({ length: 6 }, (_, i) => readU8(27 + i)),
        characterParam: Array.from({ length: 5 }, (_, i) => readU8(33 + i)),
        specialMiiRegion: readU8(38),
        _27: readU8(39),
        _28: readS16(40),
        _2a: readS16(42),
        _2c: readS16(44),
        _2e: readU8(46),
        _2f: readU8(47),
        //_30: readU16(48),
        birthYear: readS16(50)
    };
}

function decodeAndDisplay(e) {
    e.preventDefault();
    const base64UrlData = document.getElementById('dataInput').value;
    const output = document.getElementById('output');

    try {
        // Convert base64url to base64
        const base64Data = base64UrlData.replace(/-/g, '+').replace(/_/g, '/');

        // Decode base64 string
        const binaryString = atob(base64Data);

        // Convert to Uint8Array for easier access
        const data = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            data[i] = binaryString.charCodeAt(i);
        }

        // Decode to object
        const decodedObject = decodeToObject(data);

        // Programmatically display object
        let result = "";
        for (const [key, value] of Object.entries(decodedObject)) {
            result += `${key}: ${Array.isArray(value) ? '[' + value.join(', ') + ']' : value}\n`;
        }

        output.textContent = result;
    } catch (e) {
        output.textContent = "Error decoding data: " + e.message;
    }
}

window.addEventListener('load', function() {
    document.querySelector('form').requestSubmit();
});
