// Set up the scene, camera, and renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('container').appendChild(renderer.domElement);

// Add orbit controls
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Set camera position
camera.position.z = 50;
camera.position.y = 30;
camera.lookAt(0, 0, 0);

// Add ambient light
const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);

// Add point light (sun)
const sunLight = new THREE.PointLight(0xffffff, 1.5, 1000);
scene.add(sunLight);

// Add sun glow effect (implemented as a larger transparent sphere)
function createSunGlow(radius, color) {
    const glowGeometry = new THREE.SphereGeometry(radius, 32, 32);
    const glowMaterial = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.3
    });
    return new THREE.Mesh(glowGeometry, glowMaterial);
}

// Create star background
function createStars() {
    const starsGeometry = new THREE.BufferGeometry();
    const starsMaterial = new THREE.PointsMaterial({
        color: 0xFFFFFF,
        size: 0.1
    });
    
    const starsVertices = [];
    for (let i = 0; i < 10000; i++) {
        const x = (Math.random() - 0.5) * 2000;
        const y = (Math.random() - 0.5) * 2000;
        const z = (Math.random() - 0.5) * 2000;
        starsVertices.push(x, y, z);
    }
    
    starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);
}

createStars();

// Solar system data - planet name, size, distance from sun, orbit speed, color, texture
const planetData = [
    { name: 'Sun', radius: 5.0, distance: 0, speed: 0, color: 0xffff00 },
    { name: 'Mercury', radius: 0.4, distance: 10, speed: 0.04, color: 0x8a8a8a },
    { name: 'Venus', radius: 0.9, distance: 15, speed: 0.015, color: 0xe39e1c },
    { name: 'Earth', radius: 1.0, distance: 20, speed: 0.01, color: 0x3498db },
    { name: 'Mars', radius: 0.5, distance: 25, speed: 0.008, color: 0xc0392b },
    { name: 'Jupiter', radius: 2.0, distance: 32, speed: 0.002, color: 0xecf0f1 },
    { name: 'Saturn', radius: 1.7, distance: 40, speed: 0.0009, color: 0xf1c40f, hasRings: true },
    { name: 'Uranus', radius: 1.4, distance: 48, speed: 0.0004, color: 0x1abc9c },
    { name: 'Neptune', radius: 1.3, distance: 55, speed: 0.0001, color: 0x3498db }
];

// Create planets and their orbits
const planets = [];
const orbits = [];

planetData.forEach(data => {
    // Create planet
    const geometry = new THREE.SphereGeometry(data.radius, 32, 32);
    const material = new THREE.MeshLambertMaterial({ color: data.color });
    const planet = new THREE.Mesh(geometry, material);
    
    // Add planet to its initial position
    planet.position.x = data.distance;
    
    // Create planet group for orbiting
    const planetGroup = new THREE.Group();
    if (data.name !== 'Sun') {
        scene.add(planetGroup);
        planetGroup.add(planet);
        
        // Create orbit
        const orbitGeometry = new THREE.RingGeometry(data.distance - 0.1, data.distance + 0.1, 128);
        const orbitMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xffffff, 
            opacity: 0.3,
            transparent: true,
            side: THREE.DoubleSide
        });
        const orbit = new THREE.Mesh(orbitGeometry, orbitMaterial);
        orbit.rotation.x = Math.PI / 2;
        scene.add(orbit);
        orbits.push(orbit);
        
        // Add rings for Saturn
        if (data.name === 'Saturn' && data.hasRings) {
            const ringsGeometry = new THREE.RingGeometry(data.radius * 1.4, data.radius * 2.4, 64);
            const ringsMaterial = new THREE.MeshBasicMaterial({ 
                color: 0xf0e5c4,
                opacity: 0.7,
                transparent: true,
                side: THREE.DoubleSide
            });
            const rings = new THREE.Mesh(ringsGeometry, ringsMaterial);
            rings.rotation.x = Math.PI / 3;
            planet.add(rings);
        }
    } else {
        // For the sun, add it directly to the scene
        scene.add(planet);
        
        // Add glow effect to the sun
        const sunGlow1 = createSunGlow(data.radius * 1.2, 0xffff33);
        const sunGlow2 = createSunGlow(data.radius * 1.4, 0xffff00);
        const sunGlow3 = createSunGlow(data.radius * 1.7, 0xff6600);
        
        planet.add(sunGlow1);
        planet.add(sunGlow2);
        planet.add(sunGlow3);
    }
    
    // Store planet data for animation
    planets.push({
        mesh: planet,
        group: data.name !== 'Sun' ? planetGroup : null,
        data: data
    });
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    // Get the current simulation speed
    const speedFactor = parseFloat(document.getElementById('speed').value);
    
    // Update planet positions
    planets.forEach(planet => {
        if (planet.data.name !== 'Sun') {
            // Rotate planet around the sun
            planet.group.rotation.y += planet.data.speed * speedFactor;
            
            // Make planets rotate around their own axis
            planet.mesh.rotation.y += 0.01 * speedFactor;
        }
    });
    
    controls.update();
    renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Add labels to planets
function createPlanetLabels() {
    planets.forEach(planet => {
        if (planet.data.name !== 'Sun') {
            // Create canvas for the label
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = 128;
            canvas.height = 32;
            
            // Draw text on canvas
            context.font = 'Bold 16px Arial';
            context.fillStyle = 'white';
            context.textAlign = 'center';
            context.fillText(planet.data.name, 64, 16);
            
            // Create texture and sprite
            const texture = new THREE.CanvasTexture(canvas);
            const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
            const sprite = new THREE.Sprite(spriteMaterial);
            sprite.scale.set(5, 1.25, 1);
            sprite.position.y = planet.data.radius * 2;
            
            // Add to planet
            planet.mesh.add(sprite);
            planet.label = sprite;
        }
    });
}

createPlanetLabels();

// UI Controls
document.getElementById('showOrbits').addEventListener('change', function(e) {
    orbits.forEach(orbit => {
        orbit.visible = e.target.checked;
    });
});

document.getElementById('showLabels').addEventListener('change', function(e) {
    planets.forEach(planet => {
        if (planet.label) {
            planet.label.visible = e.target.checked;
        }
    });
});

document.getElementById('resetCamera').addEventListener('click', function() {
    camera.position.set(0, 30, 50);
    camera.lookAt(0, 0, 0);
    controls.update();
});

// Start animation
animate();
