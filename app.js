// Set up the scene, camera, and renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 50000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000);
document.getElementById('container').appendChild(renderer.domElement);

// Create universe group
const universe = new THREE.Group();
scene.add(universe);

// Set camera position
camera.position.set(0, 2000, 0);
camera.lookAt(0, 0, 0);

// Add ambient light
const ambientLight = new THREE.AmbientLight(0x202020);
scene.add(ambientLight);

// Initialize controls
let orbitControls = new THREE.OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping = true;
orbitControls.dampingFactor = 0.05;
orbitControls.maxDistance = 20000;

let flyControls = new THREE.FlyControls(camera, renderer.domElement);
flyControls.movementSpeed = 100;
flyControls.rollSpeed = 0.05;
flyControls.autoForward = false;
flyControls.dragToLook = true;

// Default to orbit controls
let activeControls = 'orbit';
flyControls.enabled = false;

// Generate a random color
function getRandomColor() {
    const colors = [
        0xffff00, 0xff8800, 0xff0000, 0xffccaa,
        0x88ccff, 0xaaaaff, 0x4444ff, 0xcc88ff,
        0xffaacc, 0x44ccff, 0x00ff88, 0xccffaa
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

// Blend two colors
function blendColors(color1, color2, ratio) {
    const c1 = new THREE.Color(color1);
    const c2 = new THREE.Color(color2);
    
    const r = c1.r * (1 - ratio) + c2.r * ratio;
    const g = c1.g * (1 - ratio) + c2.g * ratio;
    const b = c1.b * (1 - ratio) + c2.b * ratio;
    
    return new THREE.Color(r, g, b);
}

// Create star background
function createStarBackground() {
    const starsGeometry = new THREE.BufferGeometry();
    const starsMaterial = new THREE.PointsMaterial({
        color: 0xFFFFFF,
        size: 1.5,
        transparent: true,
        opacity: 0.8
    });
    
    const starsVertices = [];
    for (let i = 0; i < 20000; i++) {
        const x = (Math.random() - 0.5) * 40000;
        const y = (Math.random() - 0.5) * 40000;
        const z = (Math.random() - 0.5) * 40000;
        starsVertices.push(x, y, z);
    }
    
    starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);
}

// Create a galaxy
function createGalaxy(position, galaxyName, galaxySize, galaxyType, galaxyColor) {
    const galaxy = new THREE.Group();
    galaxy.position.copy(position);
    universe.add(galaxy);
    
    // Random rotation
    galaxy.rotation.x = Math.random() * Math.PI;
    galaxy.rotation.y = Math.random() * Math.PI;
    galaxy.rotation.z = Math.random() * Math.PI;
    
    // Add galaxy info
    galaxy.userData = {
        name: galaxyName,
        type: galaxyType,
        size: galaxySize,
        systems: []
    };
    
    const starCount = Math.floor(200 * galaxySize * parseFloat(document.getElementById('density').value));
    const spiral = galaxyType === 'spiral';
    
    // Create center black hole
    const blackHoleGeometry = new THREE.SphereGeometry(galaxySize * 0.5, 32, 32);
    const blackHoleMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x000000,
        transparent: true,
        opacity: 0.8
    });
    const blackHole = new THREE.Mesh(blackHoleGeometry, blackHoleMaterial);
    galaxy.add(blackHole);
    
    // Add glow to black hole
    const glowGeometry = new THREE.SphereGeometry(galaxySize * 0.6, 32, 32);
    const glowMaterial = new THREE.MeshBasicMaterial({
        color: galaxyColor,
        transparent: true,
        opacity: 0.3
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    blackHole.add(glow);
    
    // Add galaxy label
    if (document.getElementById('showLabels').checked) {
        const labelDiv = document.createElement('div');
        labelDiv.className = 'galaxy-label';
        labelDiv.textContent = galaxyName;
        const label = new CSS2DObject(labelDiv);
        label.position.set(0, galaxySize * 0.8, 0);
        galaxy.add(label);
    }
    
    // Create star systems
    const systems = [];
    const noise = new SimplexNoise();
    
    for (let i = 0; i < starCount; i++) {
        // Generate star system position
        let radius, angle, height;
        
        if (spiral) {
            // For spiral galaxies, create spiral arms
            const arms = Math.floor(Math.random() * 3) + 2; // 2-4 arms
            const armIndex = Math.floor(Math.random() * arms);
            const armOffset = (2 * Math.PI / arms) * armIndex;
            
            // Spiral parameter
            const turns = 2 + Math.random();
            radius = Math.random() * galaxySize * 20;
            angle = (radius / galaxySize) * 0.5 * turns + armOffset;
            
            // Add some randomness to the angle
            angle += (Math.random() - 0.5) * 0.5;
            
            // Height is thinner in a spiral galaxy
            height = (Math.random() - 0.5) * galaxySize * 2;
        } else {
            // For elliptical galaxies, distribute randomly
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            radius = Math.pow(Math.random(), 0.5) * galaxySize * 15;
            
            // Convert spherical to cartesian
            const x = radius * Math.sin(phi) * Math.cos(theta);
            const y = radius * Math.sin(phi) * Math.sin(theta);
            const z = radius * Math.cos(phi);
            
            // For elliptical galaxies, we'll use these directly
            angle = Math.atan2(y, x);
            height = z;
            radius = Math.sqrt(x*x + y*y);
        }
        
        // Calculate position
        const x = Math.cos(angle) * radius;
        const y = height;
        const z = Math.sin(angle) * radius;
        
        // Use noise to determine star density probability
        const noiseValue = noise.noise3D(x/galaxySize/5, y/galaxySize/5, z/galaxySize/5);
        
        // Higher probability near the center and along arms
        let probability;
        if (spiral) {
            // Higher probability along the arms for spiral galaxies
            probability = 0.7 - (radius / (galaxySize * 20)) + (noiseValue * 0.3) + 0.3;
        } else {
            // Higher probability near the center for elliptical galaxies
            probability = 0.8 - (radius / (galaxySize * 15)) + (noiseValue * 0.2);
        }
        
        // Skip this star if it doesn't meet the probability threshold
        if (Math.random() > probability) continue;
        
        // Determine star color based on position
        let starColor;
        if (spiral) {
            // In spiral galaxies, younger blue stars are in the arms, redder stars in the center
            const distanceRatio = radius / (galaxySize * 20);
            if (distanceRatio < 0.2) {
                // Red/orange stars in the center
                starColor = blendColors(0xff4400, 0xffcc00, Math.random());
            } else {
                // Bluer stars in the arms
                starColor = blendColors(0xaaaaff, 0xffffff, Math.random());
            }
        } else {
            // Elliptical galaxies have older, redder stars
            starColor = blendColors(0xff8800, 0xffaa44, Math.random());
        }
        
        // Create the star system
        const systemSize = (0.2 + Math.random() * 0.8) * galaxySize * 0.2;
        const systemPosition = new THREE.Vector3(x, y, z);
        
        // Generate system name
        const systemName = `${galaxyName.charAt(0)}${galaxyName.charAt(1)}-${Math.floor(Math.random() * 1000)}`;
        
        // Create star
        const starGeometry = new THREE.SphereGeometry(systemSize, 16, 16);
        const starMaterial = new THREE.MeshBasicMaterial({ color: starColor });
        const star = new THREE.Mesh(starGeometry, starMaterial);
        star.position.copy(systemPosition);
        
        // Add glow to star
        const starGlow = new THREE.PointLight(starColor, 0.5, galaxySize * 2);
        starGlow.position.copy(systemPosition);
        
        // Add system data
        star.userData = {
            name: systemName,
            type: Math.random() > 0.7 ? 'binary' : 'single',
            planets: Math.floor(Math.random() * 10),
            age: Math.floor(Math.random() * 10) + 1 + ' billion years',
            color: starColor,
            radius: systemSize
        };
        
        // Add star system label if enabled
        if (document.getElementById('showLabels').checked) {
            const labelDiv = document.createElement('div');
            labelDiv.className = 'system-label';
            labelDiv.textContent = systemName;
            labelDiv.style.display = 'none'; // Hidden by default, shown on zoom
            const label = new CSS2DObject(labelDiv);
            label.position.set(0, systemSize * 1.5, 0);
            star.add(label);
        }
        
        galaxy.add(star);
        galaxy.add(starGlow);
        
        systems.push(star);
        galaxy.userData.systems.push({
            mesh: star,
            name: systemName,
            position: systemPosition.clone()
        });
    }
    
    return galaxy;
}

// Create a solar system (called when zooming into a star)
function createSolarSystem(systemData) {
    // Clear any existing system
    while (scene.children.length > 0) {
        const object = scene.children[0];
        if (object.dispose) object.dispose();
        scene.remove(object);
    }
    
    // Create a new scene for the solar system
    const solarSystem = new THREE.Group();
    scene.add(solarSystem);
    
    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0x202020);
    scene.add(ambientLight);
    
    // Create the star
    const starGeometry = new THREE.SphereGeometry(5, 32, 32);
    const starMaterial = new THREE.MeshBasicMaterial({ color: systemData.color });
    const star = new THREE.Mesh(starGeometry, starMaterial);
    solarSystem.add(star);
    
    // Add point light from the star
    const starLight = new THREE.PointLight(systemData.color, 1.5, 1000);
    star.add(starLight);
    
    // Create planets
    const planetCount = systemData.planets;
    
    for (let i = 0; i < planetCount; i++) {
        const distance = 10 + i * 5 + Math.random() * 5;
        const size = 0.4 + Math.random() * 1.2;
        const planetColor = getRandomColor();
        
        // Create planet
        const planetGeometry = new THREE.SphereGeometry(size, 24, 24);
        const planetMaterial = new THREE.MeshLambertMaterial({ color: planetColor });
        const planet = new THREE.Mesh(planetGeometry, planetMaterial);
        
        // Set planet position
        planet.position.x = distance;
        
        // Create orbit group
        const orbitGroup = new THREE.Group();
        solarSystem.add(orbitGroup);
        orbitGroup.add(planet);
        
        // Create orbit visuals
        const orbitGeometry = new THREE.RingGeometry(distance - 0.1, distance + 0.1, 128);
        const orbitMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            opacity: 0.3,
            transparent: true,
            side: THREE.DoubleSide
        });
        const orbit = new THREE.Mesh(orbitGeometry, orbitMaterial);
        orbit.rotation.x = Math.PI / 2;
        solarSystem.add(orbit);
        
        // Add random moons to some planets
        if (Math.random() > 0.6) {
            const moonCount = Math.floor(Math.random() * 3) + 1;
            for (let j = 0; j < moonCount; j++) {
                const moonSize = size * 0.2;
                const moonDistance = size * 2 + j * size;
                const moonGeometry = new THREE.SphereGeometry(moonSize, 16, 16);
                const moonMaterial = new THREE.MeshLambertMaterial({ color: 0xcccccc });
                const moon = new THREE.Mesh(moonGeometry, moonMaterial);
                
                moon.position.x = moonDistance;
                
                const moonOrbit = new THREE.Group();
                planet.add(moonOrbit);
                moonOrbit.add(moon);
                
                // Add animation data
                moonOrbit.userData = {
                    rotationSpeed: 0.02 + Math.random() * 0.05,
                    type: 'moon'
                };
            }
        }
        
        // Add planet info and rotation speed
        orbitGroup.userData = {
            rotationSpeed: 0.005 + Math.random() * 0.005,
            type: 'planet'
        };
        
        planet.userData = {
            name: `Planet ${i + 1}`,
            mass: `${(size * 5).toFixed(1)} Earth masses`,
            distance: `${distance.toFixed(1)} AU`
        };
    }
    
    // Position camera to view the system
    camera.position.set(0, 30, 50);
    camera.lookAt(0, 0, 0);
    
    return solarSystem;
}

// Animate function
function animate() {
    requestAnimationFrame(animate);
    
    const delta = clock.getDelta();
    
    if (activeControls === 'fly') {
        flyControls.update(delta);
    } else {
        orbitControls.update();
    }
    
    // Animate star systems in current universe view
    if (currentView === 'universe' && universe) {
        universe.children.forEach(galaxy => {
            galaxy.rotation.y += 0.0001;
            
            // Animate systems within the galaxy (if we're currently viewing it)
            if (galaxy.visible && camera.position.distanceTo(galaxy.position) < 3000) {
                galaxy.children.forEach(child => {
                    if (child.userData && child.userData.type === 'system') {
                        child.rotation.y += 0.01;
                    }
                });
            }
        });
    }
    
    // Animate solar system if we're viewing it
    if (currentView === 'system' && currentSystem) {
        currentSystem.children.forEach(obj => {
            if (obj.userData && obj.userData.type === 'planet') {
                obj.rotation.y += obj.userData.rotationSpeed;
            }
            
            // Animate moons
            if (obj.children) {
                obj.children.forEach(child => {
                    if (child.userData && child.userData.type === 'moon') {
                        child.rotation.y += child.userData.rotationSpeed;
                    }
                });
            }
        });
    }
    
    // Show/hide system labels based on camera distance
    if (universe) {
        universe.children.forEach(galaxy => {
            if (!galaxy.visible) return;
            
            const distToGalaxy = camera.position.distanceTo(galaxy.position);
            
            // Show galaxy labels only from a distance
            galaxy.children.forEach(child => {
                if (child instanceof CSS2DObject && child.element.classList.contains('galaxy-label')) {
                    child.element.style.display = distToGalaxy > 500 ? 'block' : 'none';
                }
                
                // Show system labels only when close
                if (child instanceof THREE.Mesh && child.children) {
                    child.children.forEach(grandchild => {
                        if (grandchild instanceof CSS2DObject && grandchild.element.classList.contains('system-label')) {
                            grandchild.element.style.display = distToGalaxy < 1000 ? 'block' : 'none';
                        }
                    });
                }
            });
        });
    }
    
    labelRenderer.render(scene, camera);
    renderer.render(scene, camera);
}

// CSS2D Renderer for labels
class CSS2DObject extends THREE.Object3D {
    constructor(element) {
        super();
        this.element = element || document.createElement('div');
        this.element.style.position = 'absolute';
        this.element.style.userSelect = 'none';
        
        this.addEventListener('removed', function() {
            this.element.parentNode.removeChild(this.element);
        });
    }
    
    copy(source, recursive) {
        THREE.Object3D.prototype.copy.call(this, source, recursive);
        return this;
    }
}

class CSS2DRenderer {
    constructor() {
        const viewport = document.createElement('div');
        viewport.style.position = 'absolute';
        viewport.style.top = '0';
        viewport.style.left = '0';
        viewport.style.pointerEvents = 'none';
        
        this.domElement = viewport;
        this.scene = null;
        this.camera = null;
        this.width = 0;
        this.height = 0;
    }
    
    setSize(width, height) {
        this.width = width;
        this.height = height;
        this.domElement.style.width = width + 'px';
        this.domElement.style.height = height + 'px';
    }
    
    render(scene, camera) {
        if (this.scene !== scene || this.camera !== camera) {
            this.scene = scene;
            this.camera = camera;
            
            while (this.domElement.firstChild) {
                this.domElement.removeChild(this.domElement.firstChild);
            }
        }
        
        const objects = [];
        getObjectsWithLabels(scene, objects);
        
        for (let i = 0, l = objects.length; i < l; i++) {
            const object = objects[i];
            const element = object.element;
            
            const position = object.getWorldPosition(new THREE.Vector3());
            position.project(camera);
            
            const x = (position.x * 0.5 + 0.5) * this.width;
            const y = (-position.y * 0.5 + 0.5) * this.height;
            
            element.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
            
            if (element.parentNode !== this.domElement) {
                this.domElement.appendChild(element);
            }
        }
    }
}

function getObjectsWithLabels(object, objects) {
    if (object instanceof CSS2DObject) {
        objects.push(object);
    }
    
    for (let i = 0, l = object.children.length; i < l; i++) {
        getObjectsWithLabels(object.children[i], objects);
    }
}

// Initialize labelRenderer
const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0px';
document.body.appendChild(labelRenderer.domElement);

// Initialize clock for animation
const clock = new THREE.Clock();

// Create the universe
let galaxies = [];
let currentView = 'universe';
let currentSystem = null;

// Generate universe with galaxies
function generateUniverse() {
    // Clear existing universe
    while (universe.children.length > 0) {
        const object = universe.children[0];
        if (object.dispose) object.dispose();
        universe.remove(object);
    }
    
    galaxies = [];
    
    // Get settings from UI
    const galaxyCount = parseInt(document.getElementById('galaxyCount').value);
    
    // Create galaxies
    const galaxyTypes = ['spiral', 'elliptical'];
    const galaxyNamePrefix = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota', 'Kappa'];
    const galaxyNameSuffix = ['Prime', 'Major', 'Minor', 'Centauri', 'Proxima', 'Omega', 'Sigma', 'Tau', 'Nebula', 'Void'];
    
    for (let i = 0; i < galaxyCount; i++) {
        const spread = Math.min(4000 + (galaxyCount * 400), 10000);
        const position = new THREE.Vector3(
            (Math.random() - 0.5) * spread,
            (Math.random() - 0.5) * spread * 0.5,
            (Math.random() - 0.5) * spread
        );
        
        const galaxySize = 50 + Math.random() * 100;
        const galaxyType = galaxyTypes[Math.floor(Math.random() * galaxyTypes.length)];
        const galaxyColor = getRandomColor();
        
        // Generate galaxy name
        const prefixIndex = Math.floor(Math.random() * galaxyNamePrefix.length);
        const suffixIndex = Math.floor(Math.random() * galaxyNameSuffix.length);
        const galaxyName = `${galaxyNamePrefix[prefixIndex]} ${galaxyNameSuffix[suffixIndex]}`;
        
        const galaxy = createGalaxy(position, galaxyName, galaxySize, galaxyType, galaxyColor);
        galaxies.push(galaxy);
    }
    
    // Reset camera
    camera.position.set(0, 2000, 0);
    camera.lookAt(0, 0, 0);
    
    // Update UI
    document.getElementById('locationInfo').textContent = 'Universe Overview';
    
    currentView = 'universe';
    currentSystem = null;
}

// Initialize the universe
createStarBackground();
generateUniverse();

// Toggle between orbit and fly controls
document.getElementById('toggleView').addEventListener('click', function() {
    if (activeControls === 'orbit') {
        activeControls = 'fly';
        orbitControls.enabled = false;
        flyControls.enabled = true;
    } else {
        activeControls = 'orbit';
        flyControls.enabled = false;
        orbitControls.enabled = true;
    }
});

// Generate new universe button
document.getElementById('generateNew').addEventListener('click', function() {
    generateUniverse();
});

// Update slider labels
document.getElementById('galaxyCount').addEventListener('input', function(e) {
    document.getElementById('galaxyCountValue').textContent = e.target.value;
});

document.getElementById('density').addEventListener('input', function(e) {
    document.getElementById('densityValue').textContent = e.target.value;
});

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
});

// Double click to zoom into a galaxy or star system
window.addEventListener('dblclick', function(event) {
    const mouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
    );
    
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    
    if (currentView === 'universe') {
        // Check for intersections with galaxies or stars
        const intersects = raycaster.intersectObjects(universe.children, true);
        
        if (intersects.length > 0) {
            const object = intersects[0].object;
            
            // If it's a star
            if (object.userData && object.userData.name && object.userData.planets !== undefined) {
                // Zoom into the star system
                currentSystem = createSolarSystem(object.userData);
                currentView = 'system';
                document.getElementById('locationInfo').textContent = `Star System: ${object.userData.name}
Type: ${object.userData.type}
Planets: ${object.userData.planets}
Age: ${object.userData.age}`;
            } 
            // If it's a galaxy (or part of a galaxy)
            else {
                // Find the parent galaxy
                let galaxy = object;
                while (galaxy.parent && galaxy.parent !== universe) {
                    galaxy = galaxy.parent;
                }
                
                if (galaxy.userData && galaxy.userData.name) {
                    // Zoom into the galaxy
                    camera.position.copy(galaxy.position.clone().add(new THREE.Vector3(0, galaxy.userData.size * 5, galaxy.userData.size * 5)));
                    orbitControls.target.copy(galaxy.position);
                    document.getElementById('locationInfo').textContent = `Galaxy: ${galaxy.userData.name}
Type: ${galaxy.userData.type}
Size: ${galaxy.userData.size.toFixed(0)} light years
Star Systems: ${galaxy.userData.systems.length}`;
                }
            }
        }
    } else if (currentView === 'system') {
        // Return to universe view
        scene.remove(currentSystem);
        scene.add(universe);
        
        // Reset camera
        camera.position.set(0, 2000, 0);
        camera.lookAt(0, 0, 0);
        
        currentView = 'universe';
        currentSystem = null;
        document.getElementById('locationInfo').textContent = 'Universe Overview';
    }
});

// Start animation
animate();
