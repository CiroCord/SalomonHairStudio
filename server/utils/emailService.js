import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const getEmailTemplate = (title, content, actionButton = null) => {
    // Construimos la URL pública del logo basándonos en la URL del frontend
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:4321').replace(/\/$/, '');
    
  
    const isLocalhost = frontendUrl.includes('localhost') || frontendUrl.includes('127.0.0.1');
    
    const logoUrl = isLocalhost 
        ? "https://placehold.co/200x60/18181b/eab308?text=SALOMON+STUDIO" // Imagen pública temporal para pruebas
        : `${frontendUrl}/logo/logo-email.png`; // Tu logo real (asegúrate de que el archivo se llame así en public/logo/)

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #18181b; margin: 0; padding: 0; color: #e4e4e7; }
            .container { max-width: 600px; margin: 0 auto; background-color: #27272a; border-radius: 8px; overflow: hidden; margin-top: 20px; margin-bottom: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
            .header { background-color: #18181b; padding: 20px; text-align: center; border-bottom: 2px solid #eab308; }
            .logo { font-size: 24px; font-weight: bold; color: #eab308; letter-spacing: 2px; text-decoration: none; }
            .logo span { color: #fff; }
            .content { padding: 30px; line-height: 1.6; color: #e4e4e7; }
            .h1 { color: #eab308; font-size: 22px; margin-bottom: 20px; font-weight: bold; }
            .info-box { background-color: #3f3f46; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #eab308; }
            .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; border-bottom: 1px solid #52525b; padding-bottom: 8px; }
            .info-row:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
            .label { color: #a1a1aa; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
            .value { color: #fff; font-weight: bold; }
            .btn { display: block; width: 100%; text-align: center; background-color: #eab308; color: #18181b; padding: 15px 0; text-decoration: none; font-weight: bold; border-radius: 6px; margin-top: 25px; text-transform: uppercase; letter-spacing: 1px; }
            .btn:hover { background-color: #ca8a04; }
            .footer { background-color: #18181b; padding: 20px; text-align: center; font-size: 12px; color: #71717a; }
            .warning { color: #ef4444; font-size: 12px; margin-top: 10px; font-style: italic; }
            .p {color: #d4d4d8}
        </style>
    </head>
    <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #18181b; margin: 0; padding: 0; color: #e4e4e7;">
        <div class="container" style="max-width: 600px; margin: 0 auto; background-color: #27272a; border-radius: 8px; overflow: hidden; margin-top: 20px; margin-bottom: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">
            <div class="header" style="background-color: #18181b; padding: 20px; text-align: center; border-bottom: 2px solid #eab308;">
                <img src="${logoUrl}" alt="Salomon Studio" style="max-height: 60px; display: block; margin: 0 auto;" />
            </div>
            <div class="content" style="padding: 30px; line-height: 1.6; color: #e4e4e7;">
                <div class="h1" style="color: #eab308; font-size: 22px; margin-bottom: 20px; font-weight: bold;">${title}</div>
                <div style="color: #e4e4e7;">
                    ${content}
                </div>
                
                ${actionButton ? `<a href="${actionButton.url}" class="btn" style="display: block; width: 100%; text-align: center; background-color: #eab308; color: #18181b; padding: 15px 0; text-decoration: none; font-weight: bold; border-radius: 6px; margin-top: 25px; text-transform: uppercase; letter-spacing: 1px;">${actionButton.text}</a>` : ''}
            </div>
            <div class="footer" style="background-color: #18181b; padding: 20px; text-align: center; font-size: 12px; color: #71717a;">
                <p style="margin: 5px 0;">Salomon Hair Studio • Monroe 2248, Belgrano</p>
                <p style="margin: 5px 0;">Este es un correo automático, por favor no responder.</p>
            </div>
        </div>
    </body>
    </html>
    `;
};

export const sendBookingEmail = async (to, appointmentData) => {
    const { clientName, serviceName, professionalName, date, time, isWhatsApp } = appointmentData;
    
    // URL del frontend (asegurar que no tenga slash al final y tenga valor por defecto)
    let frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4321';
    frontendUrl = frontendUrl.replace(/\/$/, ''); // Eliminar slash final si existe
    const myAppointmentsUrl = `${frontendUrl}/mis-turnos`;

    // Estilos para la caja de información
    const boxStyle = "background-color: #3f3f46; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #eab308;";
    const rowStyle = "display: flex; justify-content: space-between; margin-bottom: 8px; border-bottom: 1px solid #52525b; padding-bottom: 8px;";
    const labelStyle = "color: #a1a1aa; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;";
    const valueStyle = "color: #fff; font-weight: bold;";

    const html = getEmailTemplate(
        '¡Turno Confirmado!',
        `
        <p style="color: #e4e4e7;">Hola <strong>${clientName}</strong>,</p>
        <p style="color: #e4e4e7;">Tu turno ha sido reservado con éxito. A continuación te dejamos los detalles:</p>
        <div style="${boxStyle}">
            <div style="${rowStyle}"><span style="${labelStyle}">Servicio</span> <span style="${valueStyle}">${serviceName}</span></div>
            <div style="${rowStyle}"><span style="${labelStyle}">Profesional</span> <span style="${valueStyle}">${professionalName}</span></div>
            <div style="${rowStyle}"><span style="${labelStyle}">Fecha</span> <span style="${valueStyle}">${date}</span></div>
            <div style="${rowStyle} border-bottom: none; margin-bottom: 0; padding-bottom: 0;"><span style="${labelStyle}">Hora</span> <span style="${valueStyle}">${time}</span></div>
        </div>
        <p style="color: #e4e4e7;">Si necesitas cancelar o reprogramar, puedes hacerlo desde tu panel de usuario.</p>
        `,
        { text: 'Gestionar Mi Turno', url: myAppointmentsUrl }
    );

    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to,
        subject: 'Confirmación de Turno - Salomon Hair Studio',
        html
    });
};

export const sendReminderEmail = async (to, type, appointmentData) => {
    const { clientName, serviceName, date, time } = appointmentData;
    
    let frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4321';
    frontendUrl = frontendUrl.replace(/\/$/, '');
    const myAppointmentsUrl = `${frontendUrl}/mis-turnos`;

    let title = '';
    let body = '';
    let subject = '';

    if (type === '3days') {
        subject = 'Recordatorio de Turno (3 días)';
        title = 'Tu turno se acerca';
        body = `
        <p style="color: #e4e4e7;">Hola <strong>${clientName}</strong>,</p>
        <p style="color: #e4e4e7;">Te recordamos que tienes un turno agendado para el servicio <strong>${serviceName}</strong> el día <strong>${date}</strong> a las <strong>${time}</strong>.</p>
        <div style="background-color: #3f3f46; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #ef4444;">
            <p style="margin:0; color: #fff;"><strong>Política de Cancelación:</strong></p>
            <p style="margin:5px 0 0 0; font-size: 13px; color: #d4d4d8;">Estás a tiempo de cancelar sin penalización. Recuerda que si cancelas con menos de 72hs de anticipación, la seña no será reembolsada.</p>
        </div>
        `;
    } else if (type === '1day') {
        subject = '¡Te esperamos mañana!';
        title = 'Mañana es tu turno';
        body = `
        <p style="color: #e4e4e7;">Hola <strong>${clientName}</strong>,</p>
        <p style="color: #e4e4e7;">Todo listo para tu servicio de <strong>${serviceName}</strong> mañana <strong>${date}</strong> a las <strong>${time}</strong>.</p>
        <p style="color: #e4e4e7;">Por favor, intenta llegar 5 minutos antes. ¡Nos vemos pronto!</p>
        `;
    }

    const html = getEmailTemplate(title, body, { text: 'Ver Detalles', url: myAppointmentsUrl });

    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to,
        subject: `${subject} - Salomon Hair Studio`,
        html
    });
};

export const sendCancellationEmail = async (to, appointmentData) => {
    const { clientName, serviceName, date, time } = appointmentData;
    
    let frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4321';
    frontendUrl = frontendUrl.replace(/\/$/, '');
    const bookingUrl = `${frontendUrl}/turnos`;

    const html = getEmailTemplate(
        'Turno Cancelado',
        `
        <p style="color: #e4e4e7;">Hola <strong>${clientName}</strong>,</p>
        <p style="color: #e4e4e7;">Te informamos que tu turno para <strong>${serviceName}</strong> el día <strong>${date}</strong> a las <strong>${time}</strong> ha sido cancelado.</p>
        <p style="color: #e4e4e7;">Si esto fue un error o deseas agendar para otro momento, puedes hacerlo nuevamente desde nuestra web.</p>
        `,
        { text: 'Reservar Nuevo Turno', url: bookingUrl }
    );

    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to,
        subject: 'Turno Cancelado - Salomon Hair Studio',
        html
    });
};

export const sendRescheduleEmail = async (to, appointmentData) => {
    const { clientName, serviceName, professionalName, oldDate, oldTime, newDate, newTime } = appointmentData;
    
    let frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4321';
    frontendUrl = frontendUrl.replace(/\/$/, '');
    const myAppointmentsUrl = `${frontendUrl}/mis-turnos`;

    // Estilos reutilizados
    const boxStyle = "background-color: #3f3f46; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #eab308;";
    const rowStyle = "display: flex; justify-content: space-between; margin-bottom: 8px; border-bottom: 1px solid #52525b; padding-bottom: 8px;";
    const labelStyle = "color: #a1a1aa; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;";
    const valueStyle = "color: #fff; font-weight: bold;";

    const html = getEmailTemplate(
        'Turno Reprogramado',
        `
        <p style="color: #e4e4e7;">Hola <strong>${clientName}</strong>,</p>
        <p style="color: #e4e4e7;">Tu turno ha sido reprogramado exitosamente. Aquí tienes los nuevos detalles:</p>
        <div style="${boxStyle}">
            <div style="${rowStyle}"><span style="${labelStyle}">Servicio</span> <span style="${valueStyle}">${serviceName}</span></div>
            <div style="${rowStyle}"><span style="${labelStyle}">Profesional</span> <span style="${valueStyle}">${professionalName}</span></div>
            <div style="${rowStyle}"><span style="${labelStyle}">Nueva Fecha</span> <span style="${valueStyle}">${newDate}</span></div>
            <div style="${rowStyle} border-bottom: none; margin-bottom: 0; padding-bottom: 0;"><span style="${labelStyle}">Nueva Hora</span> <span style="${valueStyle}">${newTime}</span></div>
        </div>
        <p style="font-size: 12px; color: #a1a1aa; margin-top: 10px;">Anteriormente: ${oldDate} a las ${oldTime}</p>
        `,
        { text: 'Ver Mi Turno', url: myAppointmentsUrl }
    );

    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to,
        subject: 'Turno Reprogramado - Salomon Hair Studio',
        html
    });
};

export const sendProfessionalCancellationEmail = async (to, appointmentData) => {
    const { clientName, serviceName, professionalName, date, time } = appointmentData;
    
    let frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4321';
    frontendUrl = frontendUrl.replace(/\/$/, '');
    const bookingUrl = `${frontendUrl}/turnos`;

    const html = getEmailTemplate(
        'Aviso Importante: Turno Cancelado',
        `
        <p style="color: #e4e4e7;">Hola <strong>${clientName}</strong>,</p>
        <p style="color: #e4e4e7;">Lamentamos informarte que el profesional <strong>${professionalName}</strong> ha tenido un imprevisto y no podrá atenderte el día <strong>${date}</strong> a las <strong>${time}</strong>.</p>
        <p style="color: #e4e4e7;">Tu turno ha sido cancelado automáticamente.</p>
        
        <div style="background-color: #3f3f46; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #eab308;">
            <p style="margin:0; color: #fff;"><strong>¿Qué puedes hacer?</strong></p>
            <ul style="color: #d4d4d8; font-size: 13px; padding-left: 20px; margin-top: 5px;">
                <li>Verificar si otro profesional está disponible ese día.</li>
                <li>Elegir una nueva fecha con ${professionalName}.</li>
            </ul>
        </div>
        
        <p style="font-size: 13px; color: #a1a1aa;">
            Si prefieres cancelar definitivamente, no necesitas hacer nada más; el turno ya ha sido dado de baja.
        </p>
        <p style="color: #e4e4e7;">Te pedimos disculpas por las molestias ocasionadas.</p>
        `,
        { text: 'Reprogramar Turno', url: bookingUrl }
    );

    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to,
        subject: 'Cambio en tu turno - Salomon Hair Studio',
        html
    });
};
