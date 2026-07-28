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

// Generate a fast fallback canvas procedural texture for Earth (instant 0ms network load)
function createProceduralEarthTexture(isDark: boolean): THREE.CanvasTexture {
    const canvas = document.createElement("canvas")
    canvas.width = 1024
    canvas.height = 512
    const ctx = canvas.getContext("2d")!

    // Base ocean background
    ctx.fillStyle = isDark ? "#080e1a" : "#1e40af"
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Tech landmass dot matrix simulation (representing continents)
    ctx.fillStyle = isDark ? "rgba(56, 189, 248, 0.45)" : "rgba(255, 255, 255, 0.55)"

    // Rough continent density shapes (North America, South America, Europe/Africa, Asia, Australia)
    for (let x = 0; x < canvas.width; x += 10) {
        for (let y = 0; y < canvas.height; y += 10) {
            const nx = (x / canvas.width) * 360 - 180
            const ny = 90 - (y / canvas.height) * 180

            // Simplified landmass bounds math
            const isNorthAmerica = nx > -160 && nx < -50 && ny > 15 && ny < 75
            const isSouthAmerica = nx > -85 && nx < -35 && ny > -55 && ny < 15
            const isEuropeAfrica = nx > -20 && nx < 55 && ny > -35 && ny < 70
            const isAsia = nx > 55 && nx < 150 && ny > 5 && ny < 75
            const isAustralia = nx > 110 && nx < 155 && ny > -42 && ny < -10

            // Perlin-style micro noise for organic continent coastlines
            const noise = Math.sin(nx * 0.08) * Math.cos(ny * 0.08) + Math.sin(nx * 0.2 + ny * 0.2) * 0.3

            if ((isNorthAmerica || isSouthAmerica || isEuropeAfrica || isAsia || isAustralia) && noise > -0.2) {
                ctx.beginPath()
                ctx.arc(x, y, 1.8, 0, Math.PI * 2)
                ctx.fill()
            }
        }
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.needsUpdate = true
    return texture
}

export function HeroGlobe() {
    const mountRef = useRef<HTMLDivElement>(null)
    const labelElementsRef = useRef<(HTMLDivElement | null)[]>([])
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
    const [loading, setLoading] = useState(true)
    const { theme } = useTheme()

    const [locating, setLocating] = useState(false)
    const [userLocation, setUserLocation] = useState<{ lat: number, lon: number, name?: string } | null>(null)
    const [isZoomedIn, setIsZoomedIn] = useState(false)

    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
    const controlsRef = useRef<OrbitControls | null>(null)

    // Build static list of location markers (Team + User)
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
            const userPos = getVector(userLocation.lat, userLocation.lon, 14)
            const targetCameraPos = userPos.clone().normalize().multiplyScalar(22)

            controls.autoRotate = false

            gsap.to(camera.position, {
                x: targetCameraPos.x,
                y: targetCameraPos.y,
                z: targetCameraPos.z,
                duration: 1.8,
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

    const effectiveTheme = getEffectiveTheme(theme)
    const isDark = effectiveTheme === "dark"

    useEffect(() => {
        if (!mountRef.current) return

        let isMounted = true

        // Clean up previous container contents
        while (mountRef.current.firstChild) {
            mountRef.current.removeChild(mountRef.current.firstChild)
        }

        if (rendererRef.current) {
            rendererRef.current.dispose()
            rendererRef.current = null
        }

        // --- THEME-BASED CONFIG ---
        const CONFIG = isDark ? {
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
        // Limit pixel ratio to max 2 for high DPI screens to prevent GPU slowdown
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" })
        renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight)
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        mountRef.current.appendChild(renderer.domElement)

        // --- CONTROLS ---
        const controls = new OrbitControls(camera, renderer.domElement)
        controls.enableDamping = true
        controls.dampingFactor = 0.05
        controls.autoRotate = true
        controls.autoRotateSpeed = 0.6
        controls.minDistance = 20
        controls.maxDistance = 70
        controls.enablePan = false
        controls.enableZoom = false
        controlsRef.current = controls

        // --- INSTANT PROCEDURAL TEXTURE + BACKGROUND LOAD ---
        const fallbackTexture = createProceduralEarthTexture(isDark)

        // --- GLOBE GROUP ---
        const globeGroup = new THREE.Group()
        scene.add(globeGroup)

        // Optimized geometry: 36x36 segments instead of 64x64 (60% vertex reduction)
        const geometry = new THREE.SphereGeometry(CONFIG.radius, 36, 36)
        const material = new THREE.MeshPhongMaterial({
            map: fallbackTexture,
            color: CONFIG.earthColor,
            emissive: CONFIG.emissive,
            emissiveIntensity: CONFIG.emissiveIntensity,
            shininess: isDark ? 5 : 15
        })
        const earth = new THREE.Mesh(geometry, material)
        globeGroup.add(earth)
        setLoading(false)

        // Async load real Earth map texture (WebP -> JPG -> remote CDN)
        const textureLoader = new THREE.TextureLoader()
        const localWebp = isDark ? '/images/earth-night.webp' : '/images/earth-blue-marble.webp'
        const localJpg = isDark ? '/images/earth-night.jpg' : '/images/earth-blue-marble.jpg'

        textureLoader.load(
            localWebp,
            (tex) => {
                if (isMounted && material) {
                    material.map = tex
                    material.needsUpdate = true
                }
            },
            undefined,
            () => {
                textureLoader.load(
                    localJpg,
                    (tex) => {
                        if (isMounted && material) {
                            material.map = tex
                            material.needsUpdate = true
                        }
                    },
                    undefined,
                    () => {
                        textureLoader.load(CONFIG.textureURL, (tex) => {
                            if (isMounted && material) {
                                material.map = tex
                                material.needsUpdate = true
                            }
                        })
                    }
                )
            }
        )

        // Tech Wireframe Overlay
        const wireGeo = new THREE.WireframeGeometry(new THREE.SphereGeometry(CONFIG.radius + 0.1, 20, 20))
        const wireMat = new THREE.LineBasicMaterial({
            color: CONFIG.colorLine,
            transparent: true,
            opacity: CONFIG.wireframeOpacity
        })
        const wireframe = new THREE.LineSegments(wireGeo, wireMat)
        globeGroup.add(wireframe)

        // Atmosphere Glow (Shader)
        const atmosGeo = new THREE.SphereGeometry(CONFIG.radius + 2.5, 32, 32)
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
                glowColor: new THREE.Uniform(
                    new THREE.Vector3(
                        CONFIG.atmosphereColor.r,
                        CONFIG.atmosphereColor.g,
                        CONFIG.atmosphereColor.b
                    )
                )
            },
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
            transparent: true
        })
        const atmosphere = new THREE.Mesh(atmosGeo, atmosMat)
        globeGroup.add(atmosphere)

        // Lighting
        const ambientLight = new THREE.AmbientLight(CONFIG.colorAmbient, isDark ? 3.0 : 2.0)
        scene.add(ambientLight)

        const sunLight = new THREE.DirectionalLight(0xffffff, isDark ? 2.0 : 1.5)
        sunLight.position.set(50, 30, 50)
        scene.add(sunLight)

        const fillLight = new THREE.DirectionalLight(0xffffff, isDark ? 1.5 : 1.0)
        fillLight.position.set(-50, -30, -50)
        scene.add(fillLight)

        const blueSpot = new THREE.SpotLight(CONFIG.colorSpot, isDark ? 10 : 5)
        blueSpot.position.set(-50, 50, 0)
        scene.add(blueSpot)

        // Markers & Packets
        interface DomElement {
            mesh: THREE.Mesh
            id: number
        }

        const domElements: DomElement[] = []
        const packets: THREE.Mesh[] = []

        locations.forEach((member, i) => {
            const pos = getVector(member.lat, member.lon, CONFIG.radius)
            const isUser = member.name === "You"

            const dot = new THREE.Mesh(
                new THREE.SphereGeometry(isUser ? 0.15 : 0.2, 12, 12),
                new THREE.MeshBasicMaterial({ color: isUser ? 0xff3b30 : CONFIG.colorDot })
            )
            dot.position.copy(pos)
            globeGroup.add(dot)

            domElements.push({ mesh: dot, id: i })

            const ring = new THREE.Mesh(
                new THREE.RingGeometry(isUser ? 0.25 : 0.3, isUser ? 0.45 : 0.5, 24),
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

            if (isUser) {
                const pinHeight = 4.0
                const tipPos = pos.clone().normalize().multiplyScalar(CONFIG.radius + pinHeight)

                const linePoints = [pos, tipPos]
                const pointerGeo = new THREE.BufferGeometry().setFromPoints(linePoints)
                const pointerMat = new THREE.LineBasicMaterial({
                    color: 0xff3b30,
                    linewidth: 2
                })
                const pointerLine = new THREE.Line(pointerGeo, pointerMat)
                globeGroup.add(pointerLine)

                const tipDot = new THREE.Mesh(
                    new THREE.SphereGeometry(0.18, 12, 12),
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
                const lineGeo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(30))
                const lineMat = new THREE.LineBasicMaterial({
                    color: CONFIG.colorLine,
                    transparent: true,
                    opacity: isDark ? 0.2 : 0.4
                })
                const line = new THREE.Line(lineGeo, lineMat)
                globeGroup.add(line)

                const packet = new THREE.Mesh(
                    new THREE.SphereGeometry(0.12, 8, 8),
                    new THREE.MeshBasicMaterial({ color: CONFIG.colorDot })
                )
                packet.userData = { curve: curve, pos: Math.random(), speed: 0.004 }
                globeGroup.add(packet)
                packets.push(packet)
            }
        })

        const raycaster = new THREE.Raycaster()
        const tempVector = new THREE.Vector3()

        let frameId: number = 0
        let isInView = true

        // ⚡ HIGH PERFORMANCE ANIMATION LOOP — Direct DOM ref manipulation, NO React state updates!
        const animate = () => {
            if (!isInView) return

            frameId = requestAnimationFrame(animate)
            controls.update()

            // Packet Animation
            for (let p = 0; p < packets.length; p++) {
                const packet = packets[p]
                if (packet.userData.curve) {
                    packet.userData.pos += packet.userData.speed
                    if (packet.userData.pos > 1) packet.userData.pos = 0
                    packet.position.copy(packet.userData.curve.getPoint(packet.userData.pos))
                }
            }

        // Direct DOM Label Position & Occlusion Sync (Zero React re-renders, 0 raycasts)
        const clientWidth = mountRef.current?.clientWidth || 0
        const clientHeight = mountRef.current?.clientHeight || 0
        const camDist = camera.position.length()
        const cosHorizon = CONFIG.radius / camDist // ~0.368 exact horizon threshold

        for (let i = 0; i < domElements.length; i++) {
            const item = domElements[i]
            const labelEl = labelElementsRef.current[item.id]
            if (!labelEl) continue

            item.mesh.getWorldPosition(tempVector)

            // Fast 0.001ms dot-product occlusion calculation for sphere centered at origin
            const dotVal = tempVector.dot(camera.position) / (CONFIG.radius * camDist)

            // Smooth opacity transition near horizon edge (fades smoothly from 1.0 to 0.0)
            const opacity = Math.max(0, Math.min(1, (dotVal - cosHorizon) / 0.12))

            // Project to screen coordinates
            const v = tempVector.project(camera)
            const x = (v.x * 0.5 + 0.5) * clientWidth
            const y = -(v.y * 0.5 - 0.5) * clientHeight

            labelEl.style.transform = `translate(-50%, -130%) translate(${x}px, ${y}px)`
            labelEl.style.opacity = opacity.toFixed(2)
        }

        renderer.render(scene, camera)
    }


        // ⚡ INTERSECTION OBSERVER: Pause animation loop when off-screen to save 100% CPU/GPU
        const observer = new IntersectionObserver(([entry]) => {
            isInView = entry.isIntersecting
            if (isInView) {
                cancelAnimationFrame(frameId)
                frameId = requestAnimationFrame(animate)
            } else {
                cancelAnimationFrame(frameId)
            }
        }, { threshold: 0.05 })

        if (mountRef.current) {
            observer.observe(mountRef.current)
        }

        animate()

        // Resize Handler
        const handleResize = () => {
            if (!mountRef.current) return
            camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight
            camera.updateProjectionMatrix()
            renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight)
        }
        window.addEventListener("resize", handleResize)

        rendererRef.current = renderer

        return () => {
            isMounted = false
            window.removeEventListener("resize", handleResize)
            observer.disconnect()
            cancelAnimationFrame(frameId)

            if (mountRef.current) {
                while (mountRef.current.firstChild) {
                    mountRef.current.removeChild(mountRef.current.firstChild)
                }
            }

            geometry.dispose()
            material.dispose()
            wireGeo.dispose()
            wireMat.dispose()
            atmosGeo.dispose()
            atmosMat.dispose()
            fallbackTexture.dispose()
            renderer.dispose()
            rendererRef.current = null
            cameraRef.current = null
            controlsRef.current = null
        }
    }, [isDark, userLocation])

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

            {/* HTML Labels Container (Direct DOM manipulated via refs for 60FPS speed without React state overhead) */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {locations.map((member, i) => (
                    <div
                        key={i}
                        ref={(el: HTMLDivElement | null): void => {
                            labelElementsRef.current[i] = el
                        }}
                        className="absolute pointer-events-none transition-opacity duration-200 opacity-0"
                        style={{ willChange: "transform, opacity" }}
                    >
                        <div className={`relative backdrop-blur-sm px-3 py-2.5 rounded text-xs min-w-[140px] ${member.name === "You"
                                ? 'bg-red-950/85 border border-red-500/50 text-white shadow-[0_4px_25px_rgba(239,68,68,0.25)] font-bold'
                                : isDark
                                    ? 'bg-[rgba(10,20,35,0.85)] border border-cyan-400/30 text-white shadow-[0_10px_30px_rgba(0,0,0,0.5)]'
                                    : 'bg-white/90 border border-blue-300/50 text-gray-800 shadow-[0_4px_20px_rgba(0,0,0,0.1)]'
                            }`}>
                            <div className="flex flex-wrap items-center gap-1 mb-1 text-[10px]">
                                <span className={`font-bold uppercase tracking-wide ${member.name === "You"
                                        ? 'text-red-400'
                                        : isDark
                                            ? 'text-cyan-400'
                                            : 'text-blue-600'
                                    }`}>
                                    {member.name === "You" ? "Innovator" : member.role}
                                </span>
                                <span className="text-slate-500">-</span>
                                <span className={`${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                                    {member.loc}
                                </span>
                            </div>
                            <div className="font-semibold text-[13px]">
                                {member.name}
                            </div>
                            <div
                                className="absolute left-1/2 bottom-[-20px] w-[1px] h-[20px]"
                                style={{
                                    background: member.name === "You"
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
