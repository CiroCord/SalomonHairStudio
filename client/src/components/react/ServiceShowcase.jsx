import React, { useRef, useState } from 'react';

const services = [
    {
        id: 1,
        title: "Corte de Caballero",
        subtitle: "Precisión & Estilo",
        description: "Un servicio de sastrería clásica adaptado a las tendencias modernas. Incluye lavado y styling.",
        image: "https://images.unsplash.com/photo-1593702295094-aea22597af65?q=80&w=800&auto=format&fit=crop",
        video: "/videos/VIDEO1.mp4" // Video de barbería
    },
    {
        id: 2,
        title: "Coloración Premium",
        subtitle: "Iluminación & Profundidad",
        description: "Técnicas avanzadas de balayage y colorimetría para un acabado natural y saludable.",
        image: "https://images.unsplash.com/photo-1562322140-8baeececf3df?q=80&w=800&auto=format&fit=crop",
        video: "/videos/VIDEO2.mp4" // Video de salón femenino
    },
    {
        id: 3,
        title: "Barba & Ritual",
        subtitle: "Toalla Caliente",
        description: "El ritual clásico de afeitado con navaja, aceites esenciales y toallas calientes.",
        image: "https://images.unsplash.com/photo-1621605815971-fbc98d665033?q=80&w=800&auto=format&fit=crop",
        video: "/videos/VIDEO3.mp4" // Video afeitado
    }
];

const ServiceCard = ({ service }) => {
    const videoRef = useRef(null);
    const [isHovered, setIsHovered] = useState(false);

    const handleMouseEnter = () => {
        setIsHovered(true);
        if (videoRef.current) {
            videoRef.current.play().catch(e => console.log("Autoplay prevented", e));
        }
    };

    const handleMouseLeave = () => {
        setIsHovered(false);
        if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
        }
    };

    return (
        <div 
            className="group relative h-[500px] w-full overflow-hidden rounded-2xl cursor-pointer shadow-2xl transition-all duration-500 hover:scale-[1.02]"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {/* Imagen Estática (Se desvanece en hover) */}
            <div className={`absolute inset-0 z-10 transition-opacity duration-700 ${isHovered ? 'opacity-0' : 'opacity-100'}`}>
                <img 
                    src={service.image} 
                    alt={service.title} 
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-80"></div>
            </div>

            {/* Video de Fondo (Aparece en hover) */}
            <video
                ref={videoRef}
                src={service.video}
                className="absolute inset-0 h-full w-full object-cover z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                loop
                muted
                playsInline
            />
            
            {/* Overlay oscuro para el video */}
            <div className="absolute inset-0 bg-black/40 z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

            {/* Contenido */}
            <div className="absolute inset-0 z-20 flex flex-col justify-end p-8">
                <div className="transform transition-transform duration-500 translate-y-4 group-hover:translate-y-0">
                    <p className="text-yellow-500 text-xs font-bold tracking-[0.3em] uppercase mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100">
                        {service.subtitle}
                    </p>
                    <h3 className="text-3xl font-serif font-bold text-white mb-3 leading-tight">
                        {service.title}
                    </h3>
                    <p className="text-gray-300 text-sm leading-relaxed max-w-xs opacity-0 group-hover:opacity-100 transition-all duration-500 delay-200 h-0 group-hover:h-auto overflow-hidden">
                        {service.description}
                    </p>
                    
                    <div className="mt-6 opacity-0 group-hover:opacity-100 transition-all duration-500 delay-300">
                        <span className="inline-block border-b border-yellow-500 text-yellow-500 text-sm font-bold pb-1">
                            Reservar Experiencia
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ServiceShowcase = () => {
    return (
        <div className="w-full">
            {/* Desktop Grid (Normal) */}
            <div className="hidden md:grid grid-cols-3 gap-6 px-4 max-w-7xl mx-auto">
                {services.map(service => (
                    <ServiceCard key={service.id} service={service} />
                ))}
            </div>

            {/* Mobile Horizontal Scroll (App-like Carousel) */}
            <div className="md:hidden flex overflow-x-auto snap-x snap-mandatory gap-4 px-4 pb-8 w-full scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
                {services.map(service => (
                    <div key={service.id} className="snap-center flex-shrink-0 w-[85vw]">
                        <ServiceCard service={service} />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ServiceShowcase;
