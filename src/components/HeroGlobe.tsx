import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { useTheme } from "./theme-provider"
import { MapPin } from "lucide-react"
import gsap from "gsap"

// Team member data
const TEAM = [
    { name: "Sarah J.", role: "Engineering Lead", loc: "New York", lat: 40.71, lon: -74.00 },
    { name: "Kenji T.", role: "AI Systems", loc: "Tokyo", lat: 35.67, lon: 139.65 },
    { name: "Elena R.", role: "Product Design", loc: "London", lat: 51.50, lon: -0.12 },
    { name: "Raj P.", role: "Backend Arch", loc: "Mumbai", lat: 19.07, lon: 72.87 },
    { name: "Lucas M.", role: "Mobile Dev", loc: "Sao Paulo", lat: -23.55, lon: -46.63 },
    { name: "Liam O.", role: "DevOps", loc: "Sydney", lat: -33.86, lon: 151.20 }
]

interface LabelData {
    id: number
    name: string
    role: string
    loc: string
    x: number
    y: number
    visible: boolean
}

// Helper to get effective theme (resolving "system" to actual theme)
function getEffectiveTheme(theme: string): "light" | "dark" {
    if (theme === "system") {
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
    }
    return theme as "light" | "dark"
}

// Helper to get 3D vector from lat/lon on sphere of radius r
function getVector(lat: number, lon: number, r: number) {
    const phi = (90 - lat) * (Math.PI / 180)
    const theta = (lon + 180) * (Math.PI / 180)
    return new THREE.Vector3(
        -(r * Math.sin(phi) * Math.cos(theta)),
        (r * Math.cos(phi)),
        (r * Math.sin(phi) * Math.sin(theta))
    )
}

export function HeroGlobe() {
    const mountRef = useRef<HTMLDivElement>(null)
    const labelsRef = useRef<HTMLDivElement>(null)
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
    const [labels, setLabels] = useState<LabelData[]>([])
    const [loading, setLoading] = useState(true)
    const { theme } = useTheme()

    const [locating, setLocating] = useState(false)
    const [userLocation, setUserLocation] = useState<{ lat: number, lon: number, name?: string } | null>(null)
    const [isZoomedIn, setIsZoomedIn] = useState(false)

    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
    const controlsRef = useRef<OrbitControls | null>(null)

    const handleShareLocation = () => {
        if (!navigator.geolocation) {
            alert("Geolocation is not supported by your browser.")
            return
        }
        setLocating(true)
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude
                const lon = position.coords.longitude

                // Fetch reverse geocoding to resolve city/region name
                fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`, {
                    headers: { 'Accept-Language': 'en' }
                })
                    .then(res => res.json())
                    .then(data => {
                        const cityName = data.address.city || data.address.town || data.address.village || data.address.state || data.address.country || "Innovator"
                        setUserLocation({ lat, lon, name: cityName })
                    })
                    .catch(() => {
                        setUserLocation({ lat, lon, name: "Innovator" })
                    })
                setIsZoomedIn(true)
                setLocating(false)
            },
            (error) => {
                console.error("Error getting location:", error)
                setLocating(false)
                alert("Could not retrieve your location. Please check browser permissions.")
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        )
    }

    // Smooth camera tracking when isZoomedIn toggles
    useEffect(() => {
        if (!cameraRef.current || !controlsRef.current || !userLocation) return

        const camera = cameraRef.current
        const controls = controlsRef.current

        if (isZoomedIn) {
            const userPos = getVector(userLocation.lat, userLocation.lon, 14) // 14 is CONFIG.radius
            const targetCameraPos = userPos.clone().normalize().multiplyScalar(22)

            controls.autoRotate = false

            gsap.to(camera.position, {
                x: targetCameraPos.x,
                y: targetCameraPos.y,
                z: targetCameraPos.z,
                duration: 2.0,
                ease: "power2.out",
                onUpdate: () => controls.update()
            })
        } else {
            controls.autoRotate = true

            gsap.to(camera.position, {
                x: 18,
                y: 10,
                z: 32,
                duration: 1.5,
                ease: "power2.out",
                onUpdate: () => controls.update()
            })
        }
    }, [isZoomedIn, userLocation])

    // Resolve effective theme
    const effectiveTheme = getEffectiveTheme(theme)
    const isDark = effectiveTheme === "dark"

    useEffect(() => {
        if (!mountRef.current) return

        // Prevent double initialization in React Strict Mode
        // Clear any existing canvas first
        while (mountRef.current.firstChild) {
            mountRef.current.removeChild(mountRef.current.firstChild)
        }

        // Clean up previous renderer if exists
        if (rendererRef.current) {
            rendererRef.current.dispose()
            rendererRef.current = null
        }

        // --- THEME-BASED CONFIG ---
        const CONFIG = isDark ? {
            // Dark mode config
            radius: 14,
            colorAmbient: 0x333333,
            colorSpot: 0x00f0ff,
            colorLine: 0x00ffff,
            colorDot: 0xffffff,
            textureURL: 'https://unpkg.com/three-globe/example/img/earth-night.jpg',
            earthColor: 0xaaaaaa,
            emissive: 0x112244,
            emissiveIntensity: 0.2,
            wireframeOpacity: 0.08,
            atmosphereColor: { r: 0.0, g: 0.8, b: 1.0 },
            fogColor: 0x02040a,
            fogDensity: 0.02
        } : {
            // Light mode config
            radius: 14,
            colorAmbient: 0x666666,
            colorSpot: 0x3b82f6,
            colorLine: 0x3b82f6,
            colorDot: 0x1e40af,
            textureURL: 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
            earthColor: 0xffffff,
            emissive: 0x000000,
            emissiveIntensity: 0,
            wireframeOpacity: 0.15,
            atmosphereColor: { r: 0.2, g: 0.5, b: 1.0 },
            fogColor: 0xf0f4ff,
            fogDensity: 0.01
        }

        // --- SCENE ---
        const scene = new THREE.Scene()
        // Only apply fog in dark mode - it causes a visible box in light mode
        if (isDark) {
            scene.fog = new THREE.FogExp2(CONFIG.fogColor, CONFIG.fogDensity)
        }

        // --- CAMERA ---
        const camera = new THREE.PerspectiveCamera(
            45,
            mountRef.current.clientWidth / mountRef.current.clientHeight,
            0.1,
            1000
        )
        camera.position.set(18, 10, 32)
        cameraRef.current = camera

        // --- RENDERER ---
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
        renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight)
        renderer.setPixelRatio(window.devicePixelRatio)
        mountRef.current.appendChild(renderer.domElement)

        // --- CONTROLS ---
        const controls = new OrbitControls(camera, renderer.domElement)
        controls.enableDamping = true
        controls.autoRotate = true
        controls.autoRotateSpeed = 0.6
        controls.minDistance = 20
        controls.maxDistance = 70
        controls.enablePan = false
        controls.enableZoom = false
        controlsRef.current = controls

        // --- TEXTURE LOADER ---
        const textureLoader = new THREE.TextureLoader()
        const earthTexture = textureLoader.load(CONFIG.textureURL, () => {
            setLoading(false)
        })

        // --- GLOBE GROUP ---
        const globeGroup = new THREE.Group()
        scene.add(globeGroup)

        // 1. The Main Earth Sphere
        const geometry = new THREE.SphereGeometry(CONFIG.radius, 64, 64)
        const material = new THREE.MeshPhongMaterial({
            map: earthTexture,
            color: CONFIG.earthColor,
            emissive: CONFIG.emissive,
            emissiveIntensity: CONFIG.emissiveIntensity,
            shininess: isDark ? 5 : 15
        })
        const earth = new THREE.Mesh(geometry, material)
        globeGroup.add(earth)

        // 2. Tech Wireframe Overlay
        const wireGeo = new THREE.WireframeGeometry(new THREE.SphereGeometry(CONFIG.radius + 0.1, 24, 24))
        const wireMat = new THREE.LineBasicMaterial({
            color: CONFIG.colorLine,
            transparent: true,
            opacity: CONFIG.wireframeOpacity
        })
        const wireframe = new THREE.LineSegments(wireGeo, wireMat)
        globeGroup.add(wireframe)

        // 3. Atmosphere Glow (Shader)
        const atmosGeo = new THREE.SphereGeometry(CONFIG.radius + 2.5, 64, 64)
        const atmosMat = new THREE.ShaderMaterial({
            vertexShader: `
                varying vec3 vNormal;
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 glowColor;
                varying vec3 vNormal;
                void main() {
                    float intensity = pow(0.6 - dot(vNormal, vec3(0, 0, 1.0)), 4.0);
                    gl_FragColor = vec4(glowColor, 1.0) * intensity;
                }
            `,
            uniforms: {
                glowColor: {
                    value: new THREE.Vector3(
                        CONFIG.atmosphereColor.r,
                        CONFIG.atmosphereColor.g,
                        CONFIG.atmosphereColor.b
                    )
                }
            },
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
            transparent: true
        })
        const atmosphere = new THREE.Mesh(atmosGeo, atmosMat)
        globeGroup.add(atmosphere)

        // --- LIGHTING ---
        const ambientLight = new THREE.AmbientLight(CONFIG.colorAmbient, isDark ? 3.0 : 2.0)
        scene.add(ambientLight)

        const sunLight = new THREE.DirectionalLight(0xffffff, isDark ? 2.0 : 1.5)
        sunLight.position.set(50, 30, 50)
        scene.add(sunLight)

        // Opposite fill light to keep both sides of the globe visible (avoiding a dark side)
        const fillLight = new THREE.DirectionalLight(0xffffff, isDark ? 1.5 : 1.0)
        fillLight.position.set(-50, -30, -50)
        scene.add(fillLight)

        const blueSpot = new THREE.SpotLight(CONFIG.colorSpot, isDark ? 10 : 5)
        blueSpot.position.set(-50, 50, 0)
        scene.add(blueSpot)

        // --- MARKERS & CONNECTIONS ---
        const locations = [...TEAM]
        if (userLocation) {
            locations.push({
                name: "You",
                role: "Innovator",
                loc: userLocation.name || "You",
                lat: userLocation.lat,
                lon: userLocation.lon
            })
        }

        interface DomElement {
            mesh: THREE.Mesh
            member: typeof locations[0]
            id: number
        }

        const domElements: DomElement[] = []
        const packets: THREE.Mesh[] = []

        locations.forEach((member, i) => {
            const pos = getVector(member.lat, member.lon, CONFIG.radius)
            const isUser = member.name === "You"

            // A. The Dot
            const dot = new THREE.Mesh(
                new THREE.SphereGeometry(isUser ? 0.15 : 0.2, 16, 16),
                new THREE.MeshBasicMaterial({ color: isUser ? 0xff3b30 : CONFIG.colorDot })
            )
            dot.position.copy(pos)
            globeGroup.add(dot)

            // Store for label tracking
            domElements.push({ mesh: dot, member, id: i })

            // B. The Ripple Ring
            const ring = new THREE.Mesh(
                new THREE.RingGeometry(isUser ? 0.25 : 0.3, isUser ? 0.45 : 0.5, 32),
                new THREE.MeshBasicMaterial({
                    color: isUser ? 0xff3b30 : CONFIG.colorLine,
                    side: THREE.DoubleSide,
                    transparent: true,
                    opacity: isUser ? 0.85 : 0.6
                })
            )
            ring.position.copy(pos)
            ring.lookAt(new THREE.Vector3(0, 0, 0))
            globeGroup.add(ring)

            // C. Connection Lines & Packets (Only for default team members loop to keep user's pin clear)
            if (isUser) {
                // Draw a 3D pointer pin/line pointing straight outward from the globe
                const pinHeight = 4.0
                const tipPos = pos.clone().normalize().multiplyScalar(CONFIG.radius + pinHeight)

                // Pin Line
                const linePoints = [pos, tipPos]
                const pointerGeo = new THREE.BufferGeometry().setFromPoints(linePoints)
                const pointerMat = new THREE.LineBasicMaterial({
                    color: 0xff3b30,
                    linewidth: 2
                })
                const pointerLine = new THREE.Line(pointerGeo, pointerMat)
                globeGroup.add(pointerLine)

                // Pin Tip Sphere
                const tipDot = new THREE.Mesh(
                    new THREE.SphereGeometry(0.18, 16, 16),
                    new THREE.MeshBasicMaterial({ color: 0xff3b30 })
                )
                tipDot.position.copy(tipPos)
                globeGroup.add(tipDot)
            } else {
                const nextIdx = (i + 1) % TEAM.length
                const nextMember = TEAM[nextIdx]
                const nextPos = getVector(nextMember.lat, nextMember.lon, CONFIG.radius)
                const dist = pos.distanceTo(nextPos)

                const mid = pos.clone().add(nextPos).multiplyScalar(0.5)
                mid.normalize().multiplyScalar(CONFIG.radius + (dist * 0.3))

                const curve = new THREE.QuadraticBezierCurve3(pos, mid, nextPos)
                const lineGeo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(50))
                const lineMat = new THREE.LineBasicMaterial({
                    color: CONFIG.colorLine,
                    transparent: true,
                    opacity: isDark ? 0.2 : 0.4
                })
                const line = new THREE.Line(lineGeo, lineMat)
                globeGroup.add(line)

                // D. Traveling Packet
                const packet = new THREE.Mesh(
                    new THREE.SphereGeometry(0.12),
                    new THREE.MeshBasicMaterial({ color: CONFIG.colorDot })
                )
                packet.userData = { curve: curve, pos: Math.random(), speed: 0.004 }
                globeGroup.add(packet)
                packets.push(packet)
            }
        })

        // --- RAYCASTER FOR OCCLUSION ---
        const raycaster = new THREE.Raycaster()

        // --- ANIMATION ---
        let frameId: number

        const animate = () => {
            frameId = requestAnimationFrame(animate)
            controls.update()

            // Packet Animation
            packets.forEach(packet => {
                if (packet.userData.curve) {
                    packet.userData.pos += packet.userData.speed
                    if (packet.userData.pos > 1) packet.userData.pos = 0
                    packet.position.copy(packet.userData.curve.getPoint(packet.userData.pos))
                }
            })

            // Label Position & Occlusion Sync
            const newLabels: LabelData[] = domElements.map(item => {
                const worldPos = item.mesh.getWorldPosition(new THREE.Vector3())

                // Occlusion check
                const dir = worldPos.clone().sub(camera.position).normalize()
                raycaster.set(camera.position, dir)
                const intersects = raycaster.intersectObject(earth)

                const distToDot = camera.position.distanceTo(worldPos)
                let isVisible = true
                if (intersects.length > 0 && intersects[0].distance < distToDot - 1.5) {
                    isVisible = false
                }

                // Project to screen coordinates
                const v = worldPos.project(camera)
                const x = (v.x * 0.5 + 0.5) * (mountRef.current?.clientWidth || 0)
                const y = -(v.y * 0.5 - 0.5) * (mountRef.current?.clientHeight || 0)

                return {
                    id: item.id,
                    name: item.member.name,
                    role: item.member.role,
                    loc: item.member.loc,
                    x,
                    y,
                    visible: isVisible
                }
            })

            setLabels(newLabels)

            renderer.render(scene, camera)
        }
        animate()

        // --- RESIZE HANDLER ---
        const handleResize = () => {
            if (!mountRef.current) return
            camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight
            camera.updateProjectionMatrix()
            renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight)
        }
        window.addEventListener("resize", handleResize)

        // Store renderer ref for cleanup
        rendererRef.current = renderer

        // --- CLEANUP ---
        return () => {
            window.removeEventListener("resize", handleResize)
            cancelAnimationFrame(frameId)

            // Clear all children from mount
            if (mountRef.current) {
                while (mountRef.current.firstChild) {
                    mountRef.current.removeChild(mountRef.current.firstChild)
                }
            }

            // Dispose Three.js resources
            geometry.dispose()
            material.dispose()
            wireGeo.dispose()
            wireMat.dispose()
            atmosGeo.dispose()
            atmosMat.dispose()
            renderer.dispose()
            rendererRef.current = null
            cameraRef.current = null
            controlsRef.current = null
        }
    }, [isDark, userLocation]) // Re-run effect when theme changes or user location changes

    return (
        <div className="relative w-full h-full min-h-[500px]">
            {/* Loading Indicator */}
            {loading && (
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-mono tracking-widest z-10 animate-pulse ${isDark ? 'text-cyan-400' : 'text-blue-600'}`}>
                    LOADING MAP DATA...
                </div>
            )}

            {/* Canvas Container */}
            <div ref={mountRef} className="w-full h-full" />

            {/* HTML Labels Container */}
            <div ref={labelsRef} className="absolute inset-0 pointer-events-none overflow-hidden">
                {labels.map(label => (
                    <div
                        key={label.id}
                        className="absolute pointer-events-none transition-opacity duration-300"
                        style={{
                            transform: `translate(-50%, -130%) translate(${label.x}px, ${label.y}px)`,
                            opacity: label.visible ? 1 : 0
                        }}
                    >
                        {/* Node Tag - Theme aware */}
                        <div className={`relative backdrop-blur-sm px-3 py-2.5 rounded text-xs min-w-[140px] ${
                            label.name === "Innovator"
                                ? 'bg-red-950/85 border border-red-500/50 text-white shadow-[0_4px_25px_rgba(239,68,68,0.25)] font-bold'
                                : isDark
                                    ? 'bg-[rgba(10,20,35,0.85)] border border-cyan-400/30 text-white shadow-[0_10px_30px_rgba(0,0,0,0.5)]'
                                    : 'bg-white/90 border border-blue-300/50 text-gray-800 shadow-[0_4px_20px_rgba(0,0,0,0.1)]'
                            }`}>
                            {/* Header: Role & Location */}
                            <div className="flex flex-wrap items-center gap-1 mb-1 text-[10px]">
                                <span className={`font-bold uppercase tracking-wide ${
                                    label.name === "You"
                                        ? 'text-red-400'
                                        : isDark
                                            ? 'text-cyan-400'
                                            : 'text-blue-600'
                                }`}>
                                    {label.name === "You" ? "Innovator" : label.role}
                                </span>
                                <span className="text-slate-500">-</span>
                                <span className={`${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                                    {label.loc}
                                </span>
                            </div>
                            {/* Name */}
                            <div className="font-semibold text-[13px]">
                                {label.name}
                            </div>

                            {/* Connector Line */}
                            <div
                                className="absolute left-1/2 bottom-[-20px] w-[1px] h-[20px]"
                                style={{
                                    background: label.name === "Innovator"
                                        ? 'linear-gradient(to bottom, #ef4444, transparent)'
                                        : isDark
                                            ? 'linear-gradient(to bottom, #00f0ff, transparent)'
                                            : 'linear-gradient(to bottom, #3b82f6, transparent)'
                                }}
                            />
                        </div>
                    </div>
                ))}
            </div>

            {/* Mark Location button */}
            {!loading && (
                <button
                    onClick={() => {
                        if (!userLocation) {
                            handleShareLocation()
                        } else {
                            setIsZoomedIn(prev => !prev)
                        }
                    }}
                    disabled={locating}
                    className={`absolute bottom-4 left-1/2 -translate-x-1/2 z-20 font-mono text-[11px] tracking-wider uppercase px-4 py-2 transition-all rounded-full flex items-center gap-1.5 pointer-events-auto ${userLocation
                            ? isDark
                                ? 'bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 shadow-[0_4px_15px_rgba(0,240,255,0.15)] hover:bg-cyan-500/30'
                                : 'bg-blue-50/90 border border-blue-300 text-blue-800 shadow-[0_4px_15px_rgba(59,130,246,0.15)] hover:bg-blue-100'
                            : locating
                                ? 'bg-slate-800/80 border border-slate-700 text-slate-400 cursor-not-allowed'
                                : isDark
                                    ? 'bg-slate-950/70 border border-cyan-400/30 text-white shadow-[0_4px_15px_rgba(0,240,255,0.1)] hover:bg-cyan-500/10 active:bg-cyan-500/20'
                                    : 'bg-white/80 border border-blue-300/50 text-blue-800 shadow-[0_4px_15px_rgba(59,130,246,0.15)] hover:bg-blue-50 hover:text-blue-900'
                        }`}
                >
                    <MapPin className={`h-3.5 w-3.5 ${userLocation ? 'text-cyan-400' : 'text-primary'}`} />
                    {userLocation
                        ? isZoomedIn
                            ? "Reset Globe View"
                            : "Focus on Me"
                        : locating
                            ? "Locating..."
                            : "Where are you? Pin location"
                    }
                </button>
            )}
        </div>
    )
}