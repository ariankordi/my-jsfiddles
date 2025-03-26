const shaders = { FFLShaderMaterial, LUTShaderMaterial };

// ─────────────────────────────────────────────────────────────
// Active Shader Class Handling
// ─────────────────────────────────────────────────────────────
let activeShaderClassName = 'FFLShaderMaterial'; // Default shader

function applyShaderMaterial(mesh, userData, originalMaterial) {
  const ShaderClass = shaders[activeShaderClassName];
  if (!ShaderClass) {
    console.error(`Shader class ${activeShaderClassName} not found.`);
    return;
  }

  const modulateColor = Array.isArray(userData.modulateColor)
    ? new THREE.Color(userData.modulateColor[0], userData.modulateColor[1], userData.modulateColor[2])
    : new THREE.Color(1, 0, 0); // Default red if missing
  
  // Create the shader material
  const shaderMaterial = new ShaderClass({
    modulateMode: userData.modulateMode,
    modulateType: userData.modulateType,
	color: modulateColor,
    side: originalMaterial.side,
	// For "MASK", only alphaTest is set.
	transparent: originalMaterial.transparent || originalMaterial.alphaTest,
    map: originalMaterial.map
  });

  // Apply the material to the mesh
  mesh.material = shaderMaterial;
}

// Apply shader to the whole model
function applyShaderMaterialToModel(model) {
  if (model) {
    model.traverse((node) => {
      if (node.isMesh && node.geometry && node.material) {
        const userData = node.geometry.userData;
        applyShaderMaterial(node, userData, node.material);
      }
    });
  }
}

// Handle shader selection change from HTML dropdown
document.getElementById('shaderSelector').addEventListener('change', function () {
  activeShaderClassName = this.value;

  const dir = shaders[activeShaderClassName].defaultLightDirection;
  // Update light direction inputs based on the selected shader's defaults
  document.getElementById('lightDirX').value = dir.x;
  document.getElementById('lightDirY').value = dir.y;
  document.getElementById('lightDirZ').value = dir.z;

  applyShaderMaterialToModel(window.model); // Apply the selected shader to the model
  updateLightDirection(); // Apply the new light direction immediately
});


// Begin Scene ----------------------------------------

// Set up the scene, camera, and renderer
const scene = new THREE.Scene();

// Set a pastel purple background color
// already set by html background
scene.background = new THREE.Color(0xE6E6FA); // Light lavender

// Perspective camera with specified parameters
const fov = 15; // Field of view in degrees
const aspect = window.innerWidth / window.innerHeight; // Aspect ratio
const near = 10; // Near clipping plane
const far = 10000; // Far clipping plane
const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);

// Position the camera and set the lookAt point
camera.position.set(0, 37.05, 415.53); // Camera position
camera.lookAt(new THREE.Vector3(0, 37.05, 0)); // LookAt point

// Initialize the WebGL renderer
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Add OrbitControls to allow mouse interaction
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.target.set(0, 37.05, 0);
controls.update();

// Variables to control rotation
let isRotating = true
let rotationSpeed = parseFloat(document.getElementById("rotationSpeed").value);

// Variable to hold the loaded model
window.model = null;

// Select the Load Model button to later disable/re-enable it
const loadModelButton = document.getElementById("loadModelButton")

// ─────────────────────────────────────────────────────────────
// Model Loading
// ─────────────────────────────────────────────────────────────
const loadModel = (url) => {
  // Disable the Load Model button when loading starts
  if (loadModelButton) loadModelButton.disabled = true

  // Remove existing model if any
  if (model) {
    scene.remove(model)
    model.traverse((child) => {
      if (child.isMesh) {
        //child.geometry.dispose()
        //if (child.material.map) child.material.map.dispose()
        //child.material.dispose()
      }
    })
    model = null
  }

  // Instantiate the GLTFLoader
  const loader = new THREE.GLTFLoader()

  // Load the glTF model
  loader.load(
    url,
    (gltf) => {
      // Extract the loaded scene/model
      window.model = gltf.scene
      
      applyShaderMaterialToModel(window.model); // Apply shader to new model
      updateLightDirection();       // Apply light direction to new model

      // Add the model to the scene
      scene.add(window.model);

      // Re-enable the Load Model button after loading completes
      loadModelButton.disabled = false
    },
    undefined,
    (error) => {
      console.error("An error occurred while loading the model:", error)
      alert("An error occurred while loading the model: " + error.toString())
      // Re-enable the Load Model button if there's an error
      loadModelButton.disabled = false
    },
  )
}

// Animation loop
const animate = () => {
  requestAnimationFrame(animate)

  // Rotate the model around the Y-axis if rotation is enabled
  if (model && isRotating) {
    model.rotation.y += rotationSpeed
  }

  // Render the scene from the camera's perspective
  renderer.render(scene, camera)
}

// Handle window resize events
window.addEventListener(
  "resize",
  () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  },
  false,
)

// Handle form submission to load a new model
document.getElementById("modelForm").addEventListener("submit", (event) => {
  event.preventDefault() // Prevent the default form submission behavior
  const url = document.getElementById("modelUrl").value.trim()
  if (url)
    loadModel(url) // Load the model from the specified URL
  else alert("Please enter a URL to a valid model in glTF format.")
})

let isPausedByButton = false // Tracks if rotation is paused via the pause button
let isPausedByMouse = false // Tracks if rotation is paused via mouse interaction

// Handle pause and resume buttons visibility and rotation state
document.getElementById("pauseButton").addEventListener("click", function () {
  isPausedByButton = true
  isRotating = false
  pauseButton.style.display = "none"
  resumeButton.style.display = "block"
})

document.getElementById("resumeButton").addEventListener("click", function () {
  isPausedByButton = false
  isRotating = true
  pauseButton.style.display = "block"
  resumeButton.style.display = "none"
})

// Add event listeners to the renderer's DOM element for mouse interactions
renderer.domElement.addEventListener("pointerdown", () => {
  if (!isPausedByButton && isRotating) {
    isRotating = false
    isPausedByMouse = true
  }
})

// Handle mouse up event to restart rotation if it wasn't paused by the button
renderer.domElement.addEventListener("pointerup", () => {
  if (isPausedByMouse && !isPausedByButton) {
    isRotating = true
    isPausedByMouse = false
  }
})

// Handle rotation speed slider
document.getElementById("rotationSpeed").addEventListener("input", function () {
  rotationSpeed = parseFloat(this.value) || 0
})

// Toggle UI functionality
const hideUiButton = document.getElementById("hideUiButton")
const showUiButton = document.getElementById("showUiButton")
const ui = document.getElementById("ui")

hideUiButton.addEventListener("click", () => {
  ui.style.display = "none"
  showUiButton.style.display = ""
})
showUiButton.addEventListener("click", () => {
  ui.style.display = ""
  showUiButton.style.display = "none"
})



// ─────────────────────────────────────────────────────────────
// Light Direction Handling
// ─────────────────────────────────────────────────────────────
const updateLightDirection = () => {
  const x = parseFloat(document.getElementById('lightDirX').value);
  const y = parseFloat(document.getElementById('lightDirY').value);
  const z = parseFloat(document.getElementById('lightDirZ').value);
  const newDir = new THREE.Vector3(x, y, z);

  if (model) {
    model.traverse((node) => {
      if (node.isMesh && node.material && node.material.lightDirection) {
		node.material.lightDirection = newDir;
      }
    });
  }
}

// Attach event listeners to light direction sliders
['lightDirX', 'lightDirY', 'lightDirZ'].forEach((id) => {
  document.getElementById(id).addEventListener('input', updateLightDirection);
});

// ─────────────────────────────────────────────────────────────
// Reset Light Direction
// ─────────────────────────────────────────────────────────────
function resetLightDirection() {
  const ShaderClass = shaders[activeShaderClassName];
  if (!ShaderClass) {
    console.error(`Shader class ${activeShaderClassName} not found.`);
    return;
  }

  const defaultDir = ShaderClass.defaultLightDirection;
  document.getElementById('lightDirX').value = defaultDir.x;
  document.getElementById('lightDirY').value = defaultDir.y;
  document.getElementById('lightDirZ').value = defaultDir.z;

  updateLightDirection(); // Apply the reset values to the shader
}

// Add event listener to the reset button
document
  .getElementById("resetLightButton")
  .addEventListener("click", resetLightDirection)

// Load the default model on startup
loadModel(document.getElementById("modelUrl").value)

// Start the animation loop
animate()
