const output = document.getElementById('output');
const sizeInput = document.getElementById('sizeInput');
const modeSelect = document.getElementById('modeSelect');

function displayMatrices(/** @type {ArrayBuffer} */ arrayBuffer) {
    const floatArray = new Float32Array(arrayBuffer);

    const desiredSize = parseInt(sizeInput.value) || 25;
    const mode = modeSelect.value;

    const floatsPerMatrix = 12; // 3 rows x 4 columns or 4 columns x 3 rows
    const matrices = [];

    const totalMatricesInFile = Math.floor(floatArray.length / floatsPerMatrix);

    for (let i = 0; i < Math.min(desiredSize, totalMatricesInFile); i++) {
        const offset = i * floatsPerMatrix;
        const matrix = [];

        // Initialize a 3x4 matrix (3 rows x 4 columns)
        for (let row = 0; row < 3; row++) {
            matrix[row] = [0, 0, 0, 0]; // 4 columns: X, Y, Z, W
        }

        if (mode === 'column-major') {
            // Column-Major Parsing
            for (let col = 0; col < 4; col++) { // 4 columns: X, Y, Z, W
                for (let row = 0; row < 3; row++) { // 3 rows
                    matrix[row][col] = floatArray[offset + col * 3 + row];
                }
            }
        } else if (mode === 'row-major') {
            // Row-Major Parsing
            for (let row = 0; row < 3; row++) { // 3 rows
                for (let col = 0; col < 4; col++) { // 4 columns: X, Y, Z, W
                    matrix[row][col] = floatArray[offset + row * 4 + col];
                }
            }
        }

        matrices.push(matrix);
    }

    // If not enough matrices, pad with zero matrices
    while (matrices.length < desiredSize) {
        const zeroMatrix = [
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0]
        ];
        matrices.push(zeroMatrix);
    }

    // Display the matrices
    output.innerHTML = ''; // Clear previous output

    matrices.forEach((matrix, index) => {
        const matrixDiv = document.createElement('div');
        matrixDiv.className = 'matrix';

        const title = document.createElement('h3');
        title.textContent = `Matrix ${index} (${mode})`;
        matrixDiv.appendChild(title);

        const table = document.createElement('table');

        // Create table headers
        const headerRow = document.createElement('tr');
        ['Row/Col', 'X', 'Y', 'Z', 'W'].forEach(text => {
            const th = document.createElement('th');
            th.textContent = text;
            headerRow.appendChild(th);
        });
        table.appendChild(headerRow);

        // Create table rows
        matrix.forEach((rowData, rowIndex) => {
            const tr = document.createElement('tr');

            const rowHeader = document.createElement('th');
            rowHeader.textContent = `Row ${rowIndex}`;
            tr.appendChild(rowHeader);

            rowData.forEach(value => {
                const td = document.createElement('td');
                td.textContent = value.toFixed(4);
                tr.appendChild(td);
            });

            table.appendChild(tr);
        });

        matrixDiv.appendChild(table);
        output.appendChild(matrixDiv);
    });
}

document.getElementById('parseForm').addEventListener('submit', (event) => {
    event.preventDefault();

    const fileInput = document.getElementById('fileInput');

    if (fileInput.files.length === 0) {
        alert('Please select a binary file to upload.');
        return;
    }

    const file = fileInput.files[0];

    const reader = new FileReader();
    reader.onload = function(event) {
        const arrayBuffer = event.target.result;
        displayMatrices(arrayBuffer);
    };

    reader.onerror = function() {
        alert('Error reading the file.');
    };

    reader.readAsArrayBuffer(file);
});


