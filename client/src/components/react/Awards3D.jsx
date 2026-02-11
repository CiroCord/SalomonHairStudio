import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { UserProvider } from './users/UserContext';

// --- DATOS DE LA HISTORIA ---
const awards = [
    {
        id: "01",
        title: "MASTER BARBER",
        year: "2019",
        description: "El inicio del viaje. Donde la técnica clásica se encuentra con la precisión moderna. Un estudio profundo de la anatomía y el estilo.",
        images: [
            "https://images.unsplash.com/photo-1503951914875-452162b7f30a?q=80&w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?q=80&w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?q=80&w=800&auto=format&fit=crop"
        ]
    },
    {
        id: "02",
        title: "COLOR SCIENCE",
        year: "2021",
        description: "Rompiendo las reglas del espectro. Química aplicada al arte del cabello para lograr tonos imposibles y vibrantes.",
        images: [
            "https://images.unsplash.com/photo-1562322140-8baeececf3df?q=80&w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1600948836101-f9ffda59d250?q=80&w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?q=80&w=800&auto=format&fit=crop"
        ]
    },
    {
        id: "03",
        title: "FULL TRAINING",
        year: "2023",
        description: "Gestión, liderazgo y la experiencia completa del cliente. Elevando el estándar de lo que significa ser un profesional.",
        images: [
            "https://images.unsplash.com/photo-1621605815971-fbc98d665033?q=80&w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?q=80&w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1532710093739-9470acff878f?q=80&w=800&auto=format&fit=crop"
        ]
    },
    {
        id: "04",
        title: "AVANT GARDE",
        year: "2024",
        description: "Visagismo avanzado. Diseñando el futuro de la imagen masculina con tendencias globales y vanguardia.",
        images: [
            "https://images.unsplash.com/photo-1593702295094-aea22597af65?q=80&w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?q=80&w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1507679799987-c73779587ccf?q=80&w=800&auto=format&fit=crop"
        ]
    }
];

// --- COMPONENTE DE FILTRO DE RUIDO (NOISE) ---
const NoiseFilter = () => (
    <svg className="hidden">
        <filter id="noiseFilter">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch" />
            <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.5 0" />
            <feBlend mode="overlay" in2="SourceGraphic" result="blend" />
        </filter>
    </svg>
);

// --- EFECTO DE TEXTO TIPO MÁQUINA DE ESCRIBIR / REVEAL ---
const TypewriterText = ({ text }) => {
    const words = text.split(" ");
    
    const container = {
        hidden: { opacity: 0 },
        visible: (i = 1) => ({
            opacity: 1,
            transition: { staggerChildren: 0.05, delayChildren: 0.02 * i },
        }),
    };

    const child = {
        visible: {
            opacity: 1,
            y: 0,
            transition: { type: "spring", damping: 12, stiffness: 100 },
        },
        hidden: {
            opacity: 0,
            y: 20,
            transition: { type: "spring", damping: 12, stiffness: 100 },
        },
    };

    return (
        <motion.div
            style={{ overflow: "hidden", display: "flex", flexWrap: "wrap" }}
            variants={container}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: false, amount: 0.5 }}
        >
            {words.map((word, index) => (
                <motion.span variants={child} style={{ marginRight: "6px" }} key={index}>
                    {word}
                </motion.span>
            ))}
        </motion.div>
    );
};

// --- SECCIÓN HORIZONTAL INDIVIDUAL ---
const HorizontalSection = ({ item }) => {
    return (
        <div className="w-full md:w-[100vw] h-screen flex items-center justify-center px-6 md:px-24 flex-shrink-0 border-b md:border-b-0 md:border-r border-zinc-300/20 relative snap-center">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 w-full max-w-7xl items-center">
                
                {/* Texto */}
                <div className="flex flex-col justify-center z-10 order-2 md:order-1">
                    <span className="text-yellow-600 font-bold tracking-[0.5em] text-sm mb-4 block">{item.year}</span>
                    <h2 className="text-5xl md:text-8xl font-serif font-black text-zinc-900 mb-8 leading-[0.8]">
                        {item.title}
                    </h2>
                    <div className="text-lg md:text-2xl text-zinc-600 font-serif italic leading-relaxed max-w-md">
                        <TypewriterText text={item.description} />
                    </div>
                </div>

                {/* Galería de Fotos (Collage) */}
                <div className="relative h-[50vh] md:h-[60vh] w-full order-1 md:order-2">
                    {item.images.map((img, idx) => (
                        <motion.div
                            key={idx}
                            className="absolute shadow-2xl border-4 border-white bg-white overflow-hidden"
                            style={{
                                width: idx === 0 ? '60%' : '45%',
                                height: idx === 0 ? '70%' : '50%',
                                top: idx === 0 ? '10%' : idx === 1 ? '0%' : '50%',
                                left: idx === 0 ? '0%' : idx === 1 ? '55%' : '40%',
                                zIndex: idx === 0 ? 10 : 20,
                            }}
                            initial={{ opacity: 0, scale: 0.8, y: 50 }}
                            whileInView={{ opacity: 1, scale: 1, y: 0 }}
                            transition={{ duration: 0.8, delay: idx * 0.2 }}
                            viewport={{ once: false }}
                        >
                            <img src={img} alt="Award" className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700" />
                        </motion.div>
                    ))}
                </div>
            </div>
            
            {/* Número gigante de fondo */}
            <div className="absolute bottom-0 right-0 text-[20vw] md:text-[30vw] font-black text-zinc-900/5 leading-none pointer-events-none select-none">
                {item.id}
            </div>
        </div>
    );
};

const AwardsContent = () => {
    const targetRef = useRef(null);
    const { scrollYProgress } = useScroll({
        target: targetRef,
    });

    // Mapeamos el scroll vertical a movimiento horizontal
    // 4 secciones = 400vw de ancho total.
    // Queremos movernos desde 0 hasta -300vw (para mostrar la última sección).
    // -75% de 400vw = -300vw.
    const x = useTransform(scrollYProgress, [0, 1], ["0%", "-75%"]); 
    
    // Suavizamos el movimiento para que se sienta "cremoso"
    const smoothX = useSpring(x, { stiffness: 40, damping: 20, mass: 0.5 });

    return (
        <div className="bg-[#EBEBE8] relative">
            <NoiseFilter />
            {/* Ocultar barra de scroll nativa para experiencia inmersiva */}
            <style>{`
                ::-webkit-scrollbar { display: none; }
                html, body { scrollbar-width: none; -ms-overflow-style: none; }
            `}</style>
            <div className="fixed inset-0 z-50 pointer-events-none opacity-40 mix-blend-multiply" style={{ filter: 'url(#noiseFilter)' }}></div>

            {/* --- VISTA ESCRITORIO (Scroll Horizontal) --- */}
            <div ref={targetRef} className="hidden md:block h-[500vh]">
                
                {/* Contenedor Sticky (Viewport) */}
                <div className="sticky top-0 h-screen overflow-hidden flex items-center">
                    
                    {/* Título Fijo */}
                    <div className="absolute top-8 left-8 z-40">
                        <h1 className="text-xl font-bold tracking-widest uppercase text-zinc-900">Salomon Archive</h1>
                        <div className="h-px w-20 bg-zinc-900 mt-2"></div>
                    </div>

                    {/* Lienzo Horizontal que se mueve */}
                    <motion.div 
                        style={{ x: smoothX }} 
                        className="flex w-[400vw] h-full"
                    >
                        {awards.map((item) => (
                            <HorizontalSection key={item.id} item={item} />
                        ))}
                    </motion.div>

                    {/* Barra de Progreso */}
                    <div className="absolute bottom-10 left-10 right-10 h-1 bg-zinc-300 rounded-full overflow-hidden z-40">
                        <motion.div 
                            className="h-full bg-yellow-600" 
                            style={{ width: useTransform(scrollYProgress, [0, 1], ["0%", "100%"]) }} 
                        />
                    </div>

                </div>
            </div>

            {/* --- VISTA MÓVIL (Scroll Vertical) --- */}
            <div className="md:hidden flex flex-col">
                {/* Título Fijo Móvil */}
                <div className="fixed top-8 left-8 z-40 mix-blend-difference text-zinc-900 pointer-events-none">
                    <h1 className="text-xl font-bold tracking-widest uppercase">Salomon Archive</h1>
                    <div className="h-px w-20 bg-zinc-900 mt-2"></div>
                </div>

                {awards.map((item) => (
                    <HorizontalSection key={item.id} item={item} />
                ))}
            </div>
            
            {/* Footer al final del scroll */}
            <div className="h-screen flex items-center justify-center bg-zinc-900 text-white relative z-10">
                <div className="text-center px-4">
                    <p className="text-zinc-500 uppercase tracking-widest mb-4">La historia continúa</p>
                    <h2 className="text-4xl md:text-6xl font-serif font-bold mb-8">¿Listo para tu cambio?</h2>
                    <a href="/turnos" className="inline-block px-10 py-4 border border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-zinc-900 transition-all uppercase tracking-widest font-bold">
                        Reservar Ahora
                    </a>
                </div>
            </div>
        </div>
    );
};

const Awards3D = () => (
    <UserProvider>
        <AwardsContent />
    </UserProvider>
);

export default Awards3D;
