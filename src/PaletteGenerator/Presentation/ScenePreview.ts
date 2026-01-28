import { SceneMaterialManager, MaterialSlot } from '../Domain/SceneMaterialManager.js';

/**
 * Scene Preview Component
 * Renders a predefined 3D scene with assignable material slots
 */
export class ScenePreview {
    private scene: any;
    private camera: any;
    private renderer: any;
    private controls: any;
    private container: HTMLElement;
    private animationFrameId: number | null = null;
    private THREE: any;
    private OrbitControls: any;
    private materialManager: SceneMaterialManager;
    
    // Scene objects with their material slots
    private meshes: Map<string, any> = new Map();
    private materials: Map<string, any> = new Map();
    private textures: Map<string, any> = new Map();

    constructor(containerId: string, materialManager: SceneMaterialManager) {
        this.container = document.getElementById(containerId) as HTMLElement;
        if (!this.container) {
            throw new Error(`Container element with id "${containerId}" not found`);
        }

        this.materialManager = materialManager;

        this.initializeThreeJS().then(() => {
            this.setupScene();
            this.createSceneObjects();
            this.setupMaterialCallbacks();
            this.startRenderLoop();
        }).catch((error) => {
            console.error('Failed to initialize Scene Preview:', error);
        });
    }

    /**
     * Dynamically imports Three.js and OrbitControls
     */
    private async initializeThreeJS(): Promise<void> {
        try {
            this.THREE = await import('three' as any);
            const orbitControlsModule = await import('three/addons/controls/OrbitControls.js' as any);
            this.OrbitControls = orbitControlsModule.OrbitControls;
        } catch (error) {
            throw new Error(`Failed to load Three.js: ${error}`);
        }
    }

    /**
     * Sets up the Three.js scene, camera, renderer, and lighting
     */
    private setupScene(): void {
        // Scene
        this.scene = new this.THREE.Scene();
        
        // Set initial sky color
        const skySlot = this.materialManager.getSlot('sky');
        this.scene.background = new this.THREE.Color(skySlot?.color || 0x87CEEB);

        // Camera - positioned to see the whole scene
        this.camera = new this.THREE.PerspectiveCamera(
            60,
            this.container.clientWidth / this.container.clientHeight,
            0.1,
            1000
        );
        this.camera.position.set(5, 4, 8);
        this.camera.lookAt(0, 0, 0);

        // Renderer
        this.renderer = new this.THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = this.THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);

        // Lighting
        const ambientLight = new this.THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);

        const directionalLight = new this.THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 15, 10);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 50;
        directionalLight.shadow.camera.left = -15;
        directionalLight.shadow.camera.right = 15;
        directionalLight.shadow.camera.top = 15;
        directionalLight.shadow.camera.bottom = -15;
        this.scene.add(directionalLight);

        // Fill light
        const fillLight = new this.THREE.DirectionalLight(0xffffff, 0.3);
        fillLight.position.set(-5, 5, -5);
        this.scene.add(fillLight);

        // Controls
        this.controls = new this.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.enableZoom = true;
        this.controls.enablePan = true;
        this.controls.target.set(0, 1, 0);
        this.controls.update();

        // Handle window resize
        window.addEventListener('resize', () => this.handleResize());
    }

    /**
     * Creates all scene objects with their materials
     */
    private createSceneObjects(): void {
        // Ground
        const groundGeometry = new this.THREE.PlaneGeometry(20, 20);
        const groundMaterial = this.createMaterial('ground');
        const ground = new this.THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = 0;
        ground.receiveShadow = true;
        this.scene.add(ground);
        this.meshes.set('ground', ground);

        // Back wall
        const wallGeometry = new this.THREE.PlaneGeometry(20, 10);
        const wallMaterial = this.createMaterial('wall');
        const wall = new this.THREE.Mesh(wallGeometry, wallMaterial);
        wall.position.set(0, 5, -10);
        wall.receiveShadow = true;
        this.scene.add(wall);
        this.meshes.set('wall', wall);

        // Primary object - Cube
        const cubeGeometry = new this.THREE.BoxGeometry(2, 2, 2);
        const cubeMaterial = this.createMaterial('primary');
        const cube = new this.THREE.Mesh(cubeGeometry, cubeMaterial);
        cube.position.set(-2, 1, 0);
        cube.castShadow = true;
        cube.receiveShadow = true;
        this.scene.add(cube);
        this.meshes.set('primary', cube);

        // Secondary object - Sphere
        const sphereGeometry = new this.THREE.SphereGeometry(1.2, 32, 32);
        const sphereMaterial = this.createMaterial('secondary');
        const sphere = new this.THREE.Mesh(sphereGeometry, sphereMaterial);
        sphere.position.set(2, 1.2, 0);
        sphere.castShadow = true;
        sphere.receiveShadow = true;
        this.scene.add(sphere);
        this.meshes.set('secondary', sphere);

        // Accent object - Cylinder
        const cylinderGeometry = new this.THREE.CylinderGeometry(0.5, 0.5, 3, 32);
        const cylinderMaterial = this.createMaterial('accent');
        const cylinder = new this.THREE.Mesh(cylinderGeometry, cylinderMaterial);
        cylinder.position.set(0, 1.5, 3);
        cylinder.castShadow = true;
        cylinder.receiveShadow = true;
        this.scene.add(cylinder);
        this.meshes.set('accent', cylinder);
    }

    /**
     * Creates a material for a slot
     */
    private createMaterial(slotId: string): any {
        const slot = this.materialManager.getSlot(slotId);
        const color = slot?.color || '#808080';

        const material = new this.THREE.MeshStandardMaterial({
            color: new this.THREE.Color(color),
            roughness: 0.7,
            metalness: 0.1
        });

        this.materials.set(slotId, material);
        return material;
    }

    /**
     * Sets up callbacks for material slot changes
     */
    private setupMaterialCallbacks(): void {
        this.materialManager.onSlotChange((slot: MaterialSlot) => {
            this.updateMaterial(slot);
        });
    }

    /**
     * Updates a material based on slot changes
     */
    private updateMaterial(slot: MaterialSlot): void {
        // Handle sky/background separately
        if (slot.id === 'sky') {
            this.scene.background = new this.THREE.Color(slot.color);
            return;
        }

        const material = this.materials.get(slot.id);
        if (!material) return;

        // Clear old texture if exists
        if (this.textures.has(slot.id)) {
            const oldTexture = this.textures.get(slot.id);
            if (oldTexture) {
                oldTexture.dispose();
            }
            this.textures.delete(slot.id);
        }

        if (slot.texture) {
            // Apply texture
            const texture = new this.THREE.CanvasTexture(slot.texture);
            texture.wrapS = this.THREE.RepeatWrapping;
            texture.wrapT = this.THREE.RepeatWrapping;
            texture.repeat.set(2, 2);
            
            material.map = texture;
            material.color.set(0xffffff);
            material.needsUpdate = true;
            
            this.textures.set(slot.id, texture);
        } else {
            // Apply color only
            material.map = null;
            material.color.set(slot.color);
            material.needsUpdate = true;
        }
    }

    /**
     * Handles window resize
     */
    private handleResize(): void {
        if (!this.camera || !this.renderer || !this.container) {
            return;
        }

        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    /**
     * Starts the render loop
     */
    private startRenderLoop(): void {
        const animate = () => {
            this.animationFrameId = requestAnimationFrame(animate);
            
            if (this.controls) {
                this.controls.update();
            }
            
            if (this.renderer && this.scene && this.camera) {
                this.renderer.render(this.scene, this.camera);
            }
        };
        animate();
    }

    /**
     * Cleanup method
     */
    dispose(): void {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }

        this.textures.forEach(texture => {
            if (texture) texture.dispose();
        });

        this.materials.forEach(material => {
            if (material) material.dispose();
        });

        this.meshes.forEach(mesh => {
            if (mesh.geometry) mesh.geometry.dispose();
        });

        if (this.renderer) {
            this.renderer.dispose();
        }
    }
}
