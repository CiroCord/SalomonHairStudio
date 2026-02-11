import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import Groq from 'groq-sdk';
import User from '../models/user.js';
import Service from '../models/Service.js';
import Professional from '../models/Professional.js';
import Appointment from '../models/Appointment.js';
import { calculateAvailability, getDateStatus } from '../controllers/appointmentController.js';
import bcrypt from 'bcrypt';
import { createGoogleEvent, createEventForUser } from './googleCalendarService.js';
import { sendBookingEmail } from '../utils/emailService.js';

// Configuración de Groq
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY, 
});

// Helper para generar calendario compacto de próximos 14 días
const getNextDays = () => {
    const days = [];
    const now = new Date();
    for (let i = 0; i < 7; i++) { // Reducimos a 7 días para ahorrar tokens en cada petición
        const d = new Date(now);
        d.setDate(now.getDate() + i);
        // Formato: "Dom 08/02/2026"
        const dayName = d.toLocaleDateString('es-AR', { weekday: 'long' });
        const dateStr = d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        days.push(`- ${dayName} ${dateStr}`);
    }
    return days.join('\n');
};

// Historial de conversación en memoria
const conversationHistory = {};

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage', // Crucial para servidores con memoria limitada (Docker/Render)
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--disable-gpu'
        ]
    }
});

client.on('qr', (qr) => qrcode.generate(qr, { small: true }));
client.on('ready', () => console.log('🤖 Bot IA de Salomon Hair Studio listo!'));

// --- DEFINICIÓN DE HERRAMIENTAS PARA LA IA ---
const tools = [
    {
        type: "function",
        function: {
            name: "check_date",
            description: "Verifica qué día de la semana cae una fecha y si la peluquería está abierta. Úsala siempre que el usuario mencione una fecha.",
            parameters: {
                type: "object",
                properties: {
                    date: { type: "string", description: "Fecha en formato YYYY-MM-DD" }
                },
                required: ["date"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_services",
            description: "Obtiene la lista de servicios de la peluquería y sus precios.",
            parameters: { type: "object", properties: {} }
        }
    },
    {
        type: "function",
        function: {
            name: "get_professionals",
            description: "Obtiene la lista de nombres de los profesionales (peluqueros) disponibles.",
            parameters: { type: "object", properties: {} }
        }
    },
    {
        type: "function",
        function: {
            name: "check_availability",
            description: "Verifica horarios disponibles para un servicio y fecha específica.",
            parameters: {
                type: "object",
                properties: {
                    serviceName: { type: "string", description: "Nombre del servicio buscado" },
                    date: { type: "string", description: "Fecha en formato YYYY-MM-DD" },
                    professionalName: { type: "string", description: "Nombre del profesional (opcional). Si es indiferente, omitir." },
                    time: { type: "string", description: "Hora específica (HH:mm) si el usuario la pide. Opcional." }
                },
                required: ["serviceName", "date"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "book_appointment",
            description: "Reserva un turno confirmado en la base de datos.",
            parameters: {
                type: "object",
                properties: {
                    serviceName: { type: "string" },
                    date: { type: "string", description: "YYYY-MM-DD" },
                    time: { type: "string", description: "HH:mm" },
                    clientName: { type: "string", description: "Nombre del cliente para el registro" },
                    professionalName: { type: "string", description: "Nombre del profesional (opcional)" }
                },
                required: ["serviceName", "date", "time", "clientName"]
            }
        }
    }
];

// --- FUNCIÓN REUTILIZABLE PARA EJECUTAR HERRAMIENTAS ---
// Extraemos esto para poder llamarlo tanto desde el flujo normal como desde el manejo de errores (fallback)
const executeTool = async (fnName, args, chatId, phoneNumber) => {
    let toolResult = "";
    console.log(`🔧 Ejecutando herramienta: ${fnName}`, args);

    // Protección: Asegurar que args sea un objeto (evita crash si es null)
    if (!args) args = {};

    // --- NORMALIZACIÓN DE ARGUMENTOS (Anti-Alucinaciones) ---
    // Si la IA usa nombres cortos incorrectos, los corregimos aquí antes de usarlos
    if (args.service && !args.serviceName) args.serviceName = args.service;
    if (args.professional && !args.professionalName) args.professionalName = args.professional;
    if (args.client && !args.clientName) args.clientName = args.client;

    if (fnName === 'check_date') {
        const [year, month, day] = args.date.split('-').map(Number);
        const dateObj = new Date(Date.UTC(year, month - 1, day));
        const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const dayName = days[dateObj.getUTCDay()];
        
        const statusInfo = await getDateStatus('any', args.date);
        
        if (statusInfo.status === 'open') {
            toolResult = `El ${args.date} es ${dayName}. La peluquería está ABIERTA. Horario: ${statusInfo.openingTime} - ${statusInfo.closingTime}.`;
        } else {
            toolResult = `El ${args.date} es ${dayName}. La peluquería está CERRADA. Razón: ${statusInfo.reason}`;
        }
    }
    
    else if (fnName === 'get_services') {
        // Traemos categoría para agrupar
        const services = await Service.find({}, 'name price category').populate('category', 'name');
        const grouped = services.reduce((acc, s) => {
            const cat = s.category ? s.category.name : 'General';
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(`${s.name} ($${s.price})`);
            return acc;
        }, {});
        toolResult = JSON.stringify(grouped);
    }

    else if (fnName === 'get_professionals') {
        const pros = await Professional.find({ active: true }, 'name');
        toolResult = JSON.stringify(pros.map(p => p.name));
    }
    
    else if (fnName === 'check_availability') {
        if (!args.serviceName) {
            return "Error: No se especificó el servicio para verificar disponibilidad.";
        }

        const servicesFound = await Service.find({ name: { $regex: args.serviceName, $options: 'i' } });
        let service = null;
        
        if (servicesFound.length === 0) {
            toolResult = "Servicio no encontrado. Pide al usuario que elija de la lista.";
        } else if (servicesFound.length === 1) {
            service = servicesFound[0];
        } else {
            const exactMatch = servicesFound.find(s => s.name.toLowerCase() === args.serviceName.toLowerCase());
            if (exactMatch) {
                service = exactMatch;
            } else {
                const names = servicesFound.map(s => s.name).join(', ');
                return `Encontré varios servicios similares: ${names}. Por favor especifica cuál deseas.`;
            }
        }

        if (service) {
            let slots = [];
            let statusInfo = null;
            
            if (args.professionalName && !['cualquiera', 'indiferente', 'da igual'].includes(args.professionalName.toLowerCase())) {
                const pro = await Professional.findOne({ name: { $regex: args.professionalName, $options: 'i' }, active: true });
                if (pro) {
                    slots = await calculateAvailability(pro._id, service._id, args.date);
                    if (slots.length === 0) statusInfo = await getDateStatus(pro._id, args.date);
                } else {
                    toolResult = `El profesional ${args.professionalName} no fue encontrado.`;
                }
            } else {
                const professionals = await Professional.find({ active: true });
                const allSlotsSet = new Set();
                for (const pro of professionals) {
                    const proSlots = await calculateAvailability(pro._id, service._id, args.date);
                    proSlots.forEach(slot => allSlotsSet.add(JSON.stringify(slot)));
                }
                slots = Array.from(allSlotsSet).map(s => JSON.parse(s)).sort((a, b) => a.startTime.localeCompare(b.startTime));
                if (slots.length === 0) statusInfo = await getDateStatus('any', args.date);
            }

            if (!toolResult) {
                if (slots.length > 0) {
                    // Si la IA preguntó por una hora específica, filtramos la respuesta para ser más naturales
                    if (args.time) {
                        const exactSlot = slots.find(s => s.startTime === args.time);
                        if (exactSlot) {
                            toolResult = `✅ El horario de las ${args.time} está DISPONIBLE. Pregunta si quiere reservarlo ahora.`;
                        } else {
                            toolResult = `❌ El horario de las ${args.time} NO está disponible. Horarios libres cercanos: ${slots.map(s => s.startTime).join(', ')}.`;
                        }
                    } else {
                        toolResult = JSON.stringify(slots);
                    }
                } else {
                    toolResult = statusInfo && statusInfo.status !== 'open' 
                        ? `No hay turnos. Razón: ${statusInfo.reason}` 
                        : "No hay turnos disponibles para esa fecha.";
                }
            }
        }
    }
    
    else if (fnName === 'book_appointment') {
        console.log("📝 Intentando reservar turno con datos:", args);
        try {
            // 1. VALIDACIONES PREVIAS (Antes de crear usuario)
            const service = await Service.findOne({ name: { $regex: args.serviceName, $options: 'i' } });
            if (!service) throw new Error("Servicio no encontrado. Verifica el nombre exacto.");

            // Validación estricta de servicio si hay ambigüedad
            const servicesFound = await Service.find({ name: { $regex: args.serviceName, $options: 'i' } });
            if (servicesFound.length > 1) {
                const exactMatch = servicesFound.find(s => s.name.toLowerCase() === args.serviceName.toLowerCase());
                if (!exactMatch) throw new Error(`Hay varios servicios llamados parecido (${servicesFound.map(s=>s.name).join(', ')}). Sé más específico.`);
            }

            let pro;
            if (args.professionalName && !['cualquiera', 'indiferente'].includes(args.professionalName.toLowerCase())) {
                pro = await Professional.findOne({ name: { $regex: args.professionalName, $options: 'i' }, active: true });
            } else {
                const professionals = await Professional.find({ active: true });
                pro = professionals[0]; // Simplificación para fallback
            }
            if (!pro) throw new Error("Profesional no encontrado");

            const [hours, minutes] = args.time.split(':').map(Number);
            const totalMinutes = hours * 60 + minutes + Number(service.duration);
            const endH = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
            const endM = (totalMinutes % 60).toString().padStart(2, '0');
            const endTime = `${endH}:${endM}`;

            // 2. BUSCAR O CREAR USUARIO (Solo si los datos del turno son válidos)
            let newUserPassword = null;
            let user = await User.findOne({ telefono: phoneNumber });
            
            if (!user) {
                let profilePicUrl = '';
                try { profilePicUrl = await client.getProfilePicUrl(chatId) || ''; } catch (e) {}
                const rawPassword = Math.random().toString(36).slice(-6);
                newUserPassword = rawPassword;
                const hashedPassword = await bcrypt.hash(rawPassword, 10);
                user = new User({
                    username: args.clientName || "Cliente WhatsApp",
                    email: `${phoneNumber}@whatsapp.user`,
                    telefono: phoneNumber,
                    password: hashedPassword,
                    role: 'client',
                    avatar: profilePicUrl,
                    isWhatsappUser: true
                });
                await user.save();
            }

            // 3. GUARDAR TURNO
            // FIX: Forzar mediodía para evitar que se guarde el día anterior por timezone UTC
            const dateFixed = new Date(args.date + 'T12:00:00');

            const newAppt = new Appointment({ date: dateFixed, startTime: args.time, endTime, client: user._id, professional: pro._id, service: service._id, services: [service._id], status: 'confirmed' });
            const savedAppt = await newAppt.save();
            console.log("✅ Turno guardado en DB con ID:", savedAppt._id);

            // (Aquí irían las integraciones de Google Calendar/Email que ya tienes, omitidas por brevedad en el diff pero mantenlas en tu código real)
            
            toolResult = "Turno reservado exitosamente. ID: " + newAppt._id;

            if (newUserPassword) {
                toolResult += `\n\n🔐 *CUENTA CREADA*\nUsuario: ${args.clientName}\nContraseña: ${newUserPassword}\n(Úsala para ver tus turnos en la web)`;
            }

        } catch (err) { toolResult = "Error al guardar el turno: " + err.message; }
    }
    return toolResult;
};

// Cambiamos 'message' por 'message_create' para detectar mensajes propios (Note to self)
client.on('message_create', async (msg) => {
    if (msg.from.includes('@g.us') || msg.from.includes('status')) return;
    
    // Si el mensaje es propio (fromMe), el chatId es el destinatario (to), si no, es el remitente (from)
    const chatId = msg.fromMe ? msg.to : msg.from;
    let text = msg.body;
    
    // FIX: Obtener número real del contacto para evitar IDs raros (@lid) y reconocer usuarios existentes
    let phoneNumber = chatId.replace(/@c\.us|@lid/, '');
    try {
        const contact = await msg.getContact();
        if (contact && contact.number) {
            phoneNumber = contact.number;
        }
    } catch (e) { console.error("Error obteniendo contacto:", e); }

    console.log(`📩 Mensaje recibido de ${phoneNumber}: ${text}`);

    // --- FILTRO GLOBAL (DEV MODE) ---
    // Solo responder si empieza con !ai o !test (para evitar gasto de tokens con mensajes ajenos)
    if (text.toLowerCase().startsWith('!test')) {
        // Pasa directo al bloque !test
    } else if (text.toLowerCase() === '!reset') {
        delete conversationHistory[chatId];
        await client.sendMessage(chatId, "🧠 Memoria de la IA borrada.");
        return;
    } else if (text.toLowerCase().startsWith('!ai')) {
        text = text.slice(3).trim();
    } else {
        return; // Ignorar todo lo demás
    }

    // --- BACKDOOR DE PRUEBA (Para probar DB sin OpenAI) ---
    // Escribe "!test Nombre" para simular el flujo sin gastar saldo
    if (text.toLowerCase().startsWith('!test')) {
        const param = text.slice(5).trim(); 
        const clientName = param || 'Cliente Prueba';
        
        await client.sendMessage(chatId, `🛠️ *Modo Debug*: Simulando reserva para "${clientName}"...`);

        try {
            // 1. Buscar o Crear Usuario (Lógica manual)
            let user = await User.findOne({ telefono: phoneNumber });
            
            if (!user) {
                let profilePicUrl = '';
                try {
                    profilePicUrl = await client.getProfilePicUrl(chatId) || '';
                } catch (picErr) { console.error("Error foto:", picErr); }
                
                // Generar contraseña aleatoria para el test
                const rawPassword = Math.random().toString(36).slice(-6);

                const hashedPassword = await bcrypt.hash(rawPassword, 10);
                user = new User({
                    username: clientName,
                    email: `${phoneNumber}@whatsapp.user`,
                    telefono: phoneNumber,
                    password: hashedPassword,
                    role: 'client',
                    avatar: profilePicUrl,
                    isWhatsappUser: true
                });
                await user.save();
                await client.sendMessage(chatId, `👤 Usuario *creado* en base de datos.\nNombre: ${clientName}\nPass: ${rawPassword}\nAvatar: ${profilePicUrl ? 'Sí' : 'No'}`);
            } else {
                await client.sendMessage(chatId, `👤 Usuario *encontrado* en base de datos: ${user.username}`);
            }

            // 2. Agendar Turno Dummy (Para verificar que se guardan)
            const service = await Service.findOne();
            const pro = await Professional.findOne({ active: true });

            if (service && pro) {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                const dateStr = tomorrow.toISOString().split('T')[0];
                
                const newAppt = new Appointment({
                    date: dateStr,
                    startTime: "10:00",
                    endTime: "11:00",
                    client: user._id,
                    professional: pro._id,
                    service: service._id,
                    status: 'confirmed'
                });
                await newAppt.save();
                await client.sendMessage(chatId, `✅ *Turno Agendado* (Simulación)\nServicio: ${service.name}\nFecha: ${dateStr} 10:00\n\n👉 Intenta loguearte en la web ahora.`);
            } else {
                await client.sendMessage(chatId, `⚠️ No se pudo agendar turno: Falta crear servicios o profesionales en el admin.`);
            }

        } catch (err) {
            await client.sendMessage(chatId, `❌ Error: ${err.message}`);
        }
        return; // Importante: No llamar a OpenAI
    }

    // Inicializar historial
    if (!conversationHistory[chatId]) {
        // 1. Identificar usuario por teléfono antes de empezar
        const user = await User.findOne({ telefono: phoneNumber });
        let userContext = "";
        
        if (user) {
            userContext = `El usuario YA ESTÁ REGISTRADO y se llama "${user.username}". Salúdalo por su nombre. No le pidas el nombre para reservar, usa el que ya tienes.`;
        } else {
            userContext = `El usuario es NUEVO (no tiene cuenta). Deberás preguntarle su nombre SOLO cuando confirme que quiere reservar un turno, para poder crearle el usuario.`;
        }

        conversationHistory[chatId] = [
            { role: "system", content: `Eres Clara, asistente de Salomon Hair Studio. Tu único objetivo es agendar turnos.
            
            DATOS TEMPORALES:
            - HOY ES: ${new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}.
            - PRÓXIMOS DÍAS: \n${getNextDays()}
            
            CONTEXTO DEL USUARIO: ${userContext}

            INSTRUCCIONES:
            1. Usa las herramientas disponibles para responder. NO inventes información.
            2. Si el usuario pide un turno, usa 'check_availability' primero.
            3. Si el usuario pide ver servicios, usa 'get_services' y muéstralos agrupados por categoría.
            4. Para reservar, obtén: Servicio EXACTO, Profesional, Fecha y Hora. PREGUNTA la fecha y hora si el usuario no la dijo explícitamente. NO ASUMAS fechas.
            5. Sé breve, amable y directa.` }
        ];
    }

    // Agregar mensaje del usuario
    conversationHistory[chatId].push({ role: "user", content: text });

    // --- OPTIMIZACIÓN DE TOKENS ---
    // Recortar historial para evitar error 429 (Rate Limit) por exceso de tokens
    if (conversationHistory[chatId].length > 10) { // Reducimos el historial para ahorrar tokens
        // Mantenemos el System Prompt (índice 0) y los últimos 9 mensajes
        conversationHistory[chatId] = [
            conversationHistory[chatId][0],
            ...conversationHistory[chatId].slice(-9)
        ];
    }

    try {
        // 1. Llamar a Groq
        const runner = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile", // Actualizado: 3.1 fue dado de baja
            messages: conversationHistory[chatId],
            tools: tools,
            tool_choice: "auto",
        });

        const responseMessage = runner.choices[0].message;

        // 2. Verificar si la IA quiere usar una herramienta
        if (responseMessage.tool_calls) {
            conversationHistory[chatId].push(responseMessage);

            for (const toolCall of responseMessage.tool_calls) {
                const fnName = toolCall.function.name;
                const args = JSON.parse(toolCall.function.arguments);
                let toolResult = "";
                toolResult = await executeTool(fnName, args, chatId, phoneNumber);

                // Devolver resultado a la IA
                conversationHistory[chatId].push({
                    tool_call_id: toolCall.id,
                    role: "tool",
                    name: fnName,
                    content: toolResult,
                });
            }

            // 3. Llamar de nuevo a Groq con los datos de la herramienta
            const finalResponse = await groq.chat.completions.create({
                model: "llama-3.3-70b-versatile",
                messages: conversationHistory[chatId],
            });
            
            const aiText = finalResponse.choices[0].message.content;
            conversationHistory[chatId].push({ role: "assistant", content: aiText });
            await client.sendMessage(chatId, aiText);

        } else {
            // Respuesta normal de texto
            const aiText = responseMessage.content;

            // --- FIX: Detectar formato XML/HTML de Llama 3.3 ---
            // Captura <function=name>args</function> o &lt;function=name&gt;args&lt;/function&gt;
            const xmlMatch = aiText.match(/(?:<|&lt;)function=(\w+)(?:>|&gt;)([\s\S]*?)(?:<|&lt;)\/function(?:>|&gt;)/);

            if (xmlMatch) {
                console.log("⚠️ Detectado intento de herramienta en texto plano. Ejecutando manual...");
                const fnName = xmlMatch[1];
                let argsStr = xmlMatch[2];

                try {
                    // Limpiar entidades HTML comunes en el JSON (ej: &quot; -> ")
                    argsStr = argsStr.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
                    let args = JSON.parse(argsStr);
                    
                    const toolResult = await executeTool(fnName, args, chatId, phoneNumber);
                    
                    // Guardamos en historial para que la IA sepa que ocurrió
                    conversationHistory[chatId].push({ role: "assistant", content: aiText });
                    conversationHistory[chatId].push({ role: "user", content: `System: Tool executed manually. Result: ${toolResult}` });

                    // Respondemos al usuario con el resultado (ej: "Turno reservado...") en lugar del código raro
                    await client.sendMessage(chatId, toolResult);
                    return; 

                } catch (e) { console.error("Error parseando herramienta manual:", e); }
            }

            conversationHistory[chatId].push({ role: "assistant", content: aiText });
            await client.sendMessage(chatId, aiText);
        }

    } catch (error) {
        console.error("❌ Error IA:", error);
        if (error.status === 429) {
            console.error("⚠️ ERROR DE CUOTA: Excediste el límite de tokens por minuto/día de Groq. El historial largo consume más tokens.");
            await client.sendMessage(chatId, "El asistente virtual no está disponible en este momento. Por favor espera a que un humano te responda.");
            return;
        }
        await client.sendMessage(chatId, "Tuve un pequeño problema técnico, ¿me repites?");
    }
});

export const startWhatsAppBot = () => {
    client.initialize();
};
