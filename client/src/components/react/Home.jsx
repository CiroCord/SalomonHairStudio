import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import HomeGallery from './HomeGallery';
import ServiceShowcase from './ServiceShowcase';

const Home = () => {
    useEffect(() => {
        // Script de animación (IntersectionObserver)
        const observerOptions = {
            root: null,
            rootMargin: '0px',
            threshold: 0.15
        };

        const observer = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        document.querySelectorAll('.reveal-on-scroll').forEach((element) => {
            observer.observe(element);
        });

        // Efecto Blur del Hero
        const heroBg = document.getElementById('hero-bg');
        const handleScroll = () => {
            if (!heroBg) return;
            const scrollY = window.scrollY;
            const blurValue = Math.min(scrollY / 40, 15);
            heroBg.style.filter = `blur(${blurValue}px)`;
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <>
            {/* HERO SECTION */}
            <section className="relative h-[calc(100vh-64px)] min-h-[600px] flex items-center justify-center text-center text-white overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/40 to-black/80 z-10"></div>
                <div id="hero-bg" className="absolute inset-0 bg-[url('https://www.bellezacampolongo.com/images/profesionales-en-peluqueria-unisex-en-pontevedra.jpg')] bg-cover bg-center scale-105 animate-slow-zoom"></div>
                
                <div className="relative z-20 max-w-3xl px-4 animate-fade-in">
                    <div className="mb-6 inline-block">
                        <span className="py-1 px-3 border border-yellow-500/50 rounded-full text-yellow-500 text-xs font-bold tracking-[0.2em] uppercase bg-black/30 backdrop-blur-sm">
                            Desde 2017
                        </span>
                    </div>
                    <h1 className="text-6xl md:text-8xl font-serif font-bold mb-6 text-white tracking-tight leading-none">
                        SALOMON <span className="text-yellow-500">STUDIO</span>
                    </h1>
                    <p className="text-lg md:text-2xl font-light tracking-[0.2em] uppercase mb-10 text-gray-300">
                        La Excelencia en Cada Detalle
                    </p>
                    
                    <div className="flex flex-col md:flex-row gap-4 justify-center items-center">
                        <Link to="/turnos" className="group relative px-8 py-4 bg-yellow-600 text-zinc-900 font-bold text-sm uppercase tracking-widest overflow-hidden rounded-sm transition-all hover:bg-yellow-500 no-underline min-w-[200px]">
                            <span className="relative z-10">Reservar Cita</span>
                        </Link>
                        <Link to="/gallery" className="group px-8 py-4 border border-white/30 text-white font-bold text-sm uppercase tracking-widest hover:bg-white hover:text-zinc-900 transition-all rounded-sm no-underline min-w-[200px]">
                            Ver Galería
                        </Link>
                    </div>
                </div>

                <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 z-20 animate-bounce">
                    <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path></svg>
                </div>
            </section>

            {/* FILOSOFÍA */}
            <section className="py-24 bg-zinc-900 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-yellow-600/10 to-transparent pointer-events-none"></div>
                <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-16 items-center relative z-10">
                    <div className="order-2 md:order-1">
                        <div className="relative group">
                            <div className="absolute -top-4 -left-4 w-24 h-24 border-t-2 border-l-2 border-yellow-500/50 transition-all duration-500 group-hover:-top-6 group-hover:-left-6"></div>
                            <img src="https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=1000&auto=format&fit=crop" alt="Interior Salon" className="w-full h-[500px] object-cover grayscale hover:grayscale-0 transition-all duration-700 shadow-2xl rounded-sm" />
                            <div className="absolute -bottom-4 -right-4 w-24 h-24 border-b-2 border-r-2 border-yellow-500/50 transition-all duration-500 group-hover:-bottom-6 group-hover:-right-6"></div>
                        </div>
                    </div>
                    <div className="order-1 md:order-2">
                        <h2 className="text-yellow-500 text-sm font-bold tracking-[0.3em] uppercase mb-4">Nuestra Filosofía</h2>
                        <h3 className="text-4xl md:text-5xl font-serif font-bold mb-8 leading-tight">Más que un corte,<br/>una declaración.</h3>
                        <p className="text-gray-400 text-lg leading-relaxed mb-6">
                            En Salomon Studio, entendemos que tu imagen es tu carta de presentación al mundo. No solo cortamos cabello; esculpimos confianza.
                        </p>
                        <div className="flex gap-8 mt-10">
                            <div><span className="block text-3xl font-serif text-white font-bold">500+</span><span className="text-xs text-yellow-500 uppercase tracking-wider">Clientes Felices</span></div>
                            <div><span className="block text-3xl font-serif text-white font-bold">10+</span><span className="text-xs text-yellow-500 uppercase tracking-wider">Años de Experiencia</span></div>
                        </div>
                    </div>
                </div>
            </section>

            {/* SERVICIOS */}
            <section className="py-24 bg-zinc-50 reveal-on-scroll">
                <div className="text-center mb-20">
                    <span className="text-yellow-600 text-xs font-bold tracking-[0.3em] uppercase block mb-3">Experiencias</span>
                    <h2 className="text-4xl md:text-5xl font-serif font-bold text-zinc-900">Servicios de Autor</h2>
                </div>
                <ServiceShowcase />
                <div className="text-center mt-16">
                    <Link to="/turnos" className="inline-block border-b-2 border-zinc-900 text-zinc-900 font-bold uppercase tracking-widest pb-1 hover:text-yellow-600 hover:border-yellow-600 transition-colors text-sm no-underline">
                        Ver Menú Completo
                    </Link>
                </div>
            </section>

            {/* GALERÍA */}
            <section className="py-24 bg-zinc-900 border-t border-zinc-800 reveal-on-scroll">
                <div className="container mx-auto px-4 mb-12 flex justify-between items-end">
                    <div>
                        <h2 className="text-3xl font-serif font-bold text-white">Salomon Gallery</h2>
                        <p className="text-gray-500 mt-2">Inspiración real de nuestros clientes.</p>
                    </div>
                    <Link to="/gallery" className="hidden md:block text-yellow-500 hover:text-white transition-colors text-sm font-bold uppercase tracking-wider no-underline">Ver Todo →</Link>
                </div>
                <div className="container mx-auto px-4">
                    <HomeGallery />
                </div>
                <div className="text-center mt-10 md:hidden">
                    <Link to="/gallery" className="text-yellow-500 hover:text-white transition-colors text-sm font-bold uppercase tracking-wider no-underline">Ver Todo →</Link>
                </div>
            </section>
        </>
    );
};

export default Home;