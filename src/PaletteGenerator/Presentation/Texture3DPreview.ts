/**
 * 3D texture preview component
 * Displays textures on 3D models using Three.js
 */
export class Texture3DPreview {
    private scene: any;
    private camera: any;
    private renderer: any;
    private controls: any;
    private currentMesh: any = null;
    private currentTexture: any = null;
    private container: HTMLElement;
    private modelType: 'cube' | 'sphere' | 'plane' = 'cube';
    private animationFrameId: number | null = null;
    private THREE: any;
    private OrbitControls: any;

    constructor(containerId: string, modelSelectorId: string) {
        this.container = document.getElementById(containerId) as HTMLElement;
        if (!this.container) {
            throw new Error(`Container element with id "${containerId}" not found`);
        }

        this.initializeThreeJS().then(() => {
            this.setupScene();
            this.setupEventListeners(modelSelectorId);
            this.startRenderLoop();
        }).catch((error) => {
            console.error('Failed to initialize Three.js:', error);
        });
    }

    /**
     * Dynamically imports Three.js and OrbitControls
     */
    private async initializeThreeJS(): Promise<void> {
        try {
            // Import Three.js using import map (resolved at runtime by browser)
            this.THREE = await import('three' as any);
            
            // Import OrbitControls using import map (resolved at runtime by browser)
            const orbitControlsModule = await import('three/addons/controls/OrbitControls.js' as any);
            
            // Store OrbitControls constructor
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
        this.scene.background = new this.THREE.Color(0xf5f5f5);

        // Camera
        this.camera = new this.THREE.PerspectiveCamera(
            75,
            this.container.clientWidth / this.container.clientHeight,
            0.1,
            1000
        );
        this.camera.position.set(0, 0, 3);

        // Renderer
        this.renderer = new this.THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);

        // Lighting
        const ambientLight = new this.THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new this.THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 5, 5);
        this.scene.add(directionalLight);

        // Controls
        this.controls = new this.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.enableZoom = true;
        this.controls.enablePan = false;

        // Handle window resize
        window.addEventListener('resize', () => this.handleResize());

        // Create initial model
        this.createModel();
    }

    /**
     * Sets up event listeners for model selector
     */
    private setupEventListeners(modelSelectorId: string): void {
        const modelSelector = document.getElementById(modelSelectorId) as HTMLSelectElement;
        if (modelSelector) {
            modelSelector.addEventListener('change', (e) => {
                const value = (e.target as HTMLSelectElement).value;
                if (value === 'cube' || value === 'sphere' || value === 'plane') {
                    this.modelType = value;
                    this.createModel();
                }
            });
        }
    }

    /**
     * Creates a 3D model based on current modelType
     */
    private createModel(): void {
        // Remove existing mesh
        if (this.currentMesh) {
            this.scene.remove(this.currentMesh);
            if (this.currentMesh.geometry) {
                this.currentMesh.geometry.dispose();
            }
            if (this.currentMesh.material) {
                this.currentMesh.material.dispose();
            }
        }

        let geometry: any;
        
        switch (this.modelType) {
            case 'cube':
                geometry = new this.THREE.BoxGeometry(1, 1, 1);
                break;
            case 'sphere':
                geometry = new this.THREE.SphereGeometry(1, 32, 32);
                break;
            case 'plane':
                geometry = new this.THREE.PlaneGeometry(2, 2);
                break;
        }

        // Create material with current texture or default color
        const material = new this.THREE.MeshStandardMaterial({
            map: this.currentTexture || null,
            color: this.currentTexture ? 0xffffff : 0xcccccc
        });

        this.currentMesh = new this.THREE.Mesh(geometry, material);
        this.scene.add(this.currentMesh);
    }

    /**
     * Updates the texture on the 3D model
     * @param canvas Canvas element with adjusted texture
     */
    updateTexture(canvas: HTMLCanvasElement): void {
        if (!canvas || !this.THREE) {
            return;
        }

        // Dispose old texture
        if (this.currentTexture) {
            this.currentTexture.dispose();
        }

        // Create new texture from canvas
        this.currentTexture = new this.THREE.CanvasTexture(canvas);
        this.currentTexture.needsUpdate = true;
        this.currentTexture.wrapS = this.THREE.RepeatWrapping;
        this.currentTexture.wrapT = this.THREE.RepeatWrapping;

        // Update material
        if (this.currentMesh && this.currentMesh.material) {
            this.currentMesh.material.map = this.currentTexture;
            this.currentMesh.material.needsUpdate = true;
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

        if (this.currentTexture) {
            this.currentTexture.dispose();
        }

        if (this.currentMesh) {
            if (this.currentMesh.geometry) {
                this.currentMesh.geometry.dispose();
            }
            if (this.currentMesh.material) {
                this.currentMesh.material.dispose();
            }
        }

        if (this.renderer) {
            this.renderer.dispose();
        }
    }
}
