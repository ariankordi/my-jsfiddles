// Example Data (replace with the full data you have)
const haircolorTable = [
  { id: 0, r: 30, g: 26, b: 23 },
  { id: 1, r: 64, g: 31, b: 16 },
  { id: 2, r: 92, g: 23, b: 9 },
  { id: 3, r: 123, g: 57, b: 19 },
  { id: 4, r: 120, g: 120, b: 128 },
  { id: 5, r: 78, g: 61, b: 16 },
  { id: 6, r: 135, g: 87, b: 23 },
  { id: 7, r: 208, g: 159, b: 73 },
]

const eyecolorTable = [
  { id: 0, r: 0, g: 0, b: 0 },
  { id: 1, r: 108, g: 111, b: 111 },
  { id: 2, r: 102, g: 59, b: 44 },
  { id: 3, r: 95, g: 94, b: 47 },
  { id: 4, r: 70, g: 83, b: 168 },
  { id: 5, r: 56, g: 111, b: 87 },
]

const glasscolorTable = [
  { id: 0, r: 23, g: 23, b: 23 },
  { id: 1, r: 95, g: 55, b: 15 },
  { id: 2, r: 167, g: 15, b: 7 },
  { id: 3, r: 31, g: 47, b: 103 },
  { id: 4, r: 167, g: 95, b: 0 },
  { id: 5, r: 119, g: 111, b: 103 },
]

const mouthcolorTable = [
  { id: 0, r: 215, g: 82, b: 7 },
  { id: 1, r: 239, g: 11, b: 7 },
  { id: 2, r: 245, g: 71, b: 71 },
  { id: 3, r: 239, g: 154, b: 116 },
  { id: 4, r: 139, g: 80, b: 64 },
]

const commonColors = [
  {
    id: 2,
    r: 92,
    g: 24,
    b: 10,
  },
  {
    id: 24,
    r: 132,
    g: 38,
    b: 38,
  },
  {
    id: 10,
    r: 102,
    g: 60,
    b: 44,
  },
  {
    id: 23,
    r: 140,
    g: 80,
    b: 64,
  },
  {
    id: 15,
    r: 168,
    g: 16,
    b: 8,
  },
  {
    id: 20,
    r: 240,
    g: 12,
    b: 8,
  },
  {
    id: 21,
    r: 245,
    g: 72,
    b: 72,
  },
  {
    id: 25,
    r: 255,
    g: 115,
    b: 102,
  },
  {
    id: 26,
    r: 255,
    g: 166,
    b: 166,
  },
  {
    id: 27,
    r: 255,
    g: 192,
    b: 186,
  },
  {
    id: 28,
    r: 115,
    g: 46,
    b: 59,
  },
  {
    id: 29,
    r: 153,
    g: 31,
    b: 61,
  },
  {
    id: 30,
    r: 138,
    g: 23,
    b: 62,
  },
  {
    id: 31,
    r: 181,
    g: 62,
    b: 66,
  },
  {
    id: 32,
    r: 199,
    g: 30,
    b: 86,
  },
  {
    id: 33,
    r: 176,
    g: 83,
    b: 129,
  },
  {
    id: 34,
    r: 199,
    g: 84,
    b: 110,
  },
  {
    id: 35,
    r: 250,
    g: 117,
    b: 151,
  },
  {
    id: 36,
    r: 252,
    g: 172,
    b: 201,
  },
  {
    id: 37,
    r: 255,
    g: 201,
    b: 216,
  },
  {
    id: 38,
    r: 49,
    g: 28,
    b: 64,
  },
  {
    id: 39,
    r: 55,
    g: 40,
    b: 61,
  },
  {
    id: 40,
    r: 76,
    g: 24,
    b: 77,
  },
  {
    id: 41,
    r: 111,
    g: 66,
    b: 179,
  },
  {
    id: 42,
    r: 133,
    g: 92,
    b: 184,
  },
  {
    id: 43,
    r: 192,
    g: 131,
    b: 204,
  },
  {
    id: 44,
    r: 168,
    g: 147,
    b: 201,
  },
  {
    id: 45,
    r: 197,
    g: 172,
    b: 230,
  },
  {
    id: 46,
    r: 238,
    g: 190,
    b: 250,
  },
  {
    id: 47,
    r: 210,
    g: 197,
    b: 237,
  },
  {
    id: 48,
    r: 25,
    g: 31,
    b: 64,
  },
  {
    id: 16,
    r: 32,
    g: 48,
    b: 104,
  },
  {
    id: 49,
    r: 18,
    g: 63,
    b: 102,
  },
  {
    id: 12,
    r: 70,
    g: 84,
    b: 168,
  },
  {
    id: 50,
    r: 42,
    g: 130,
    b: 212,
  },
  {
    id: 51,
    r: 87,
    g: 180,
    b: 242,
  },
  {
    id: 52,
    r: 122,
    g: 197,
    b: 222,
  },
  {
    id: 53,
    r: 137,
    g: 166,
    b: 250,
  },
  {
    id: 54,
    r: 132,
    g: 189,
    b: 250,
  },
  {
    id: 55,
    r: 161,
    g: 227,
    b: 255,
  },
  {
    id: 56,
    r: 11,
    g: 46,
    b: 54,
  },
  {
    id: 57,
    r: 1,
    g: 61,
    b: 59,
  },
  {
    id: 58,
    r: 13,
    g: 79,
    b: 89,
  },
  {
    id: 59,
    r: 35,
    g: 102,
    b: 99,
  },
  {
    id: 13,
    r: 56,
    g: 112,
    b: 88,
  },
  {
    id: 60,
    r: 48,
    g: 126,
    b: 140,
  },
  {
    id: 61,
    r: 79,
    g: 174,
    b: 176,
  },
  {
    id: 62,
    r: 122,
    g: 196,
    b: 158,
  },
  {
    id: 63,
    r: 127,
    g: 212,
    b: 192,
  },
  {
    id: 64,
    r: 135,
    g: 229,
    b: 182,
  },
  {
    id: 65,
    r: 10,
    g: 74,
    b: 53,
  },
  {
    id: 66,
    r: 67,
    g: 122,
    b: 0,
  },
  {
    id: 67,
    r: 2,
    g: 117,
    b: 98,
  },
  {
    id: 68,
    r: 54,
    g: 153,
    b: 112,
  },
  {
    id: 69,
    r: 75,
    g: 173,
    b: 26,
  },
  {
    id: 70,
    r: 146,
    g: 191,
    b: 10,
  },
  {
    id: 71,
    r: 99,
    g: 199,
    b: 136,
  },
  {
    id: 72,
    r: 158,
    g: 224,
    b: 66,
  },
  {
    id: 73,
    r: 150,
    g: 222,
    b: 126,
  },
  {
    id: 74,
    r: 187,
    g: 242,
    b: 170,
  },
  {
    id: 5,
    r: 78,
    g: 62,
    b: 16,
  },
  {
    id: 11,
    r: 96,
    g: 94,
    b: 48,
  },
  {
    id: 75,
    r: 153,
    g: 147,
    b: 43,
  },
  {
    id: 76,
    r: 166,
    g: 149,
    b: 99,
  },
  {
    id: 77,
    r: 204,
    g: 192,
    b: 57,
  },
  {
    id: 78,
    r: 204,
    g: 185,
    b: 135,
  },
  {
    id: 79,
    r: 217,
    g: 204,
    b: 130,
  },
  {
    id: 80,
    r: 213,
    g: 217,
    b: 111,
  },
  {
    id: 81,
    r: 213,
    g: 230,
    b: 131,
  },
  {
    id: 82,
    r: 216,
    g: 250,
    b: 157,
  },
  {
    id: 14,
    r: 96,
    g: 56,
    b: 16,
  },
  {
    id: 83,
    r: 125,
    g: 69,
    b: 0,
  },
  {
    id: 6,
    r: 136,
    g: 88,
    b: 24,
  },
  {
    id: 17,
    r: 168,
    g: 96,
    b: 0,
  },
  {
    id: 7,
    r: 208,
    g: 160,
    b: 74,
  },
  {
    id: 84,
    r: 230,
    g: 187,
    b: 122,
  },
  {
    id: 85,
    r: 254,
    g: 226,
    b: 74,
  },
  {
    id: 86,
    r: 250,
    g: 222,
    b: 130,
  },
  {
    id: 87,
    r: 247,
    g: 234,
    b: 156,
  },
  {
    id: 88,
    r: 250,
    g: 248,
    b: 155,
  },
  {
    id: 1,
    r: 64,
    g: 32,
    b: 16,
  },
  {
    id: 3,
    r: 124,
    g: 58,
    b: 20,
  },
  {
    id: 89,
    r: 166,
    g: 77,
    b: 30,
  },
  {
    id: 19,
    r: 216,
    g: 82,
    b: 8,
  },
  {
    id: 90,
    r: 255,
    g: 150,
    b: 13,
  },
  {
    id: 91,
    r: 209,
    g: 155,
    b: 105,
  },
  {
    id: 22,
    r: 240,
    g: 154,
    b: 116,
  },
  {
    id: 92,
    r: 255,
    g: 178,
    b: 102,
  },
  {
    id: 93,
    r: 255,
    g: 194,
    b: 140,
  },
  {
    id: 94,
    r: 229,
    g: 207,
    b: 177,
  },
  {
    id: 8,
    r: 0,
    g: 0,
    b: 0,
  },
  {
    id: 0,
    r: 45,
    g: 40,
    b: 40,
  },
  {
    id: 95,
    r: 65,
    g: 65,
    b: 65,
  },
  {
    id: 9,
    r: 108,
    g: 112,
    b: 112,
  },
  {
    id: 18,
    r: 120,
    g: 112,
    b: 104,
  },
  {
    id: 4,
    r: 120,
    g: 120,
    b: 128,
  },
  {
    id: 96,
    r: 155,
    g: 155,
    b: 155,
  },
  {
    id: 97,
    r: 190,
    g: 190,
    b: 190,
  },
  {
    id: 98,
    r: 220,
    g: 215,
    b: 205,
  },
  {
    id: 99,
    r: 255,
    g: 255,
    b: 255,
  },
]
const ToVer3HairColorTable = [
  /* 0:  */ 0, 1, 2, 3, 4, 5, 6, 7, 0, 4, 3, 5, 4, 5 /* < 13, orig. val: 4 */, 6, 2, 0, 6, 4, 3, 2, 2, 7, 3, 2, 2,
  /* 26: */ 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 4, 4, 4, 4, 4, 4, 4, 0, 0, 4, 4,
  /* 52: */ 4, 4, 4, 4, 0, 0, 0, 5 /* < 59, orig. val: 4 */, 4, 4, 4, 4, 4, 5, 5, 5, 4, 4, 7 /* 70, < orig. val: 4 */, 4, 4, 4, 4, 5, 7, 5,
  /* 78: */ 7, 7, 7, 7, 7, 6, 7, 7, 7, 7, 7, 3, 7, 7, 7, 7, 7, 0, 4, 4, 4, 4,
]
const ToVer3EyeColorTable = [
  /* 0:  */ 0, 2, 2, 2, 1, 3, 2, 3, 0, 1, 2, 3, 4, 5, 2, 2, 4, 2, 1, 2, 2, 2, 2, 2, 2, 2,
  /* 26: */ 2, 1 /* < 27, orig. val: 2 */, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1 /* < 37, orig. val: 2 */, 0, 0, 4, 4, 4, 4, 4, 4, 4, 1, 0, 4, 4, 4,
  /* 52: */ 4, 4, 4, 4, 0, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 3, 3, 3,
  /* 78: */ 3, 3, 3, 3, 3, 2, 2, 3, 3, 3, 3, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1,
]
const ToVer3MouthColorTable = [
  /* 0:  */ 4, 4, 4, 4, 4, 4, 4, 3, 4, 4, 4, 4, 4, 4, 4, 1, 4, 4, 4, 0, 1, 2, 3, 4, 4, 2,
  /* 26: */ 3, 3, 4, 4, 4, 4, 1, 4, 4, 2, 3, 3, 4, 4, 4, 4, 4, 4, 4, 3, 3, 3, 4, 4, 4, 3,
  /* 52: */ 3, 3, 3, 3, 4, 4, 4, 4, 4, 3, 3, 3, 3, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3, 4, 4, 3,
  /* 78: */ 3, 3, 3, 3, 3, 4, 3, 3, 3, 3, 3, 4, 0, 3, 3, 3, 3, 4, 3, 3, 3, 3,
]
const ToVer3GlassColorTable = [
  /* 0:  */ 0, 1, 1, 1, 5, 1, 1, 4, 0, 5, 1, 1, 3, 5, 1, 2, 3, 4, 5, 4, 2, 2, 4, 4, 2, 2,
  /* 26: */ 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3,
  /* 52: */ 3, 3, 3, 3, 0, 0, 0, 5, 5, 5, 5, 5, 5, 0, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 4 /* < 77, orig. val: 5 */,
  /* 78: */ 5, 5, 5, 5, 5, 1, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5,
]
// Add the details section for hair colors
function createColorDetails(title, ver3Colors, mappingTable) {
  const details = document.createElement("details")
  const summary = document.createElement("summary")
  summary.innerHTML = `<h3>${title}</h3>`
  details.appendChild(summary)

    // Add Ver3 color rectangles
    ver3Colors.forEach(color => {
        const colorRect = document.createElement('div');
        colorRect.className = 'color-rect';
        colorRect.style.backgroundColor = `rgb(${color.r}, ${color.g}, ${color.b})`;
        colorRect.textContent = color.id;

        // Adjust text color for contrast
        const brightness = (color.r * 0.299 + color.g * 0.587 + color.b * 0.114) / 255;
        colorRect.style.color = brightness > 0.5 ? 'black' : 'white';

        // Highlight selected Ver3 color
        colorRect.addEventListener('click', () => {
            document.querySelectorAll('.color-rect').forEach(el => el.classList.remove('highlight'));
            colorRect.classList.add('highlight');
            showCommonColors(color.id, mappingTable);
        });

        details.appendChild(colorRect);
    });
  return details
}

function showCommonColors(ver3Id, mappingTable) {
    const commonColorsDiv = document.getElementById('common-colors');
    const mappingCountDiv = document.getElementById('mapping-count');
    commonColorsDiv.innerHTML = ''; // Clear previous content

    // Find all common colors mapping to the selected Ver3 color
    const mappedIndexes = mappingTable.reduce((indexes, val, index) => {
        if (val === ver3Id) indexes.push(index);
        return indexes;
    }, []);

    // Display common colors
    mappedIndexes.forEach(index => {
        const color = commonColors.find(c => c.id === index);
        if (!color) return; // Skip if no color exists
        const colorSquare = document.createElement('div');
        colorSquare.className = 'color-square';
        colorSquare.style.backgroundColor = `rgb(${color.r}, ${color.g}, ${color.b})`;
        colorSquare.textContent = index;

        // Adjust text color for contrast
        const brightness = (color.r * 0.299 + color.g * 0.587 + color.b * 0.114) / 255;
        colorSquare.style.color = brightness > 0.5 ? 'black' : 'white';

        commonColorsDiv.appendChild(colorSquare);
    });

    // Show total count of mappings
    mappingCountDiv.textContent = `Total mappings for Ver3 Color ${ver3Id}: ${mappedIndexes.length}`;
}

// Initialize the details section
const detailsContainer = document.getElementById("details-container")
detailsContainer.appendChild(
  createColorDetails("Hair Colors", haircolorTable, ToVer3HairColorTable),
)
detailsContainer.appendChild(
  createColorDetails("Eye Colors", eyecolorTable, ToVer3EyeColorTable),
)

detailsContainer.appendChild(
  createColorDetails("Glass Colors", glasscolorTable, ToVer3GlassColorTable),
)

detailsContainer.appendChild(
  createColorDetails("Mouth Colors", mouthcolorTable, ToVer3MouthColorTable),
)
