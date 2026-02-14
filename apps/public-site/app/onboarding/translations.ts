// Multi-language translations for vendor onboarding
export const translations = {
    en: {
        // Headers
        urgentTitle: "Complete Your Compliance Profile",
        standardTitle: "Join the Xiri Supply Network",
        urgentSubtitle: "We have an active contract ready for {{businessName}}. Please upload your documents to be cleared for work.",
        standardSubtitle: "Expand your business with Xiri. Register {{businessName}} to receive commercial cleaning leads.",

        // Business Info
        businessInfo: "Business Information",
        companyName: "Company Name",
        primaryEmail: "Primary Email",

        // Compliance
        complianceRequired: "Compliance Required",
        complianceDesc: "You must upload proof of insurance and a W-9 to be assigned this contract.",
        businessVerification: "Business & Insurance Verification",
        businessVerificationDesc: "Please confirm your business structure and insurance coverage. Documents will be requested when a job is assigned.",

        // Business Structure
        businessStructure: "Business Structure",
        hasBusinessEntity: "I have a registered business entity (LLC/Corp/Partnership)",

        // Insurance
        insuranceCoverage: "Insurance Coverage",
        generalLiability: "General Liability Insurance",
        generalLiabilityDesc: "Minimum $1M coverage required",
        workersComp: "Workers' Compensation Insurance",
        workersCompDesc: "Required if you have employees",
        workersCompRequired: "Required in {{state}}",
        autoInsurance: "Commercial Auto Insurance",
        autoInsuranceDesc: "Required for service vehicles",
        pollutionLiability: "Pollution Liability Insurance",
        pollutionLiabilityDesc: "Required for medical facility cleaning",

        // File Upload
        coiLabel: "Liability Insurance (COI)",
        coiDesc: "Must be valid for at least 3 months",
        w9Label: "IRS Form W-9",
        w9Desc: "Most recent tax year",
        selectFile: "Select File",
        uploaded: "Uploaded",

        // Buttons
        submit: "Submit Compliance Docs",
        complete: "Complete Registration",
        processing: "Processing...",

        // Success
        successTitle: "Application Received",
        successFastTrack: "Our compliance team is reviewing your documents. Expect a call within 24 hours.",
        successStandard: "You have been added to the Xiri Supply Network. We will contact you when jobs match your profile."
    },
    es: {
        // Headers
        urgentTitle: "Complete Su Perfil de Cumplimiento",
        standardTitle: "Únase a la Red de Proveedores Xiri",
        urgentSubtitle: "Tenemos un contrato activo listo para {{businessName}}. Por favor cargue sus documentos para ser autorizado para trabajar.",
        standardSubtitle: "Expanda su negocio con Xiri. Registre {{businessName}} para recibir oportunidades de limpieza comercial.",

        // Business Info
        businessInfo: "Información del Negocio",
        companyName: "Nombre de la Empresa",
        primaryEmail: "Correo Electrónico Principal",

        // Compliance
        complianceRequired: "Cumplimiento Requerido",
        complianceDesc: "Debe cargar prueba de seguro y un W-9 para ser asignado a este contrato.",
        businessVerification: "Verificación de Negocio y Seguros",
        businessVerificationDesc: "Por favor confirme la estructura de su negocio y cobertura de seguros. Los documentos se solicitarán cuando se asigne un trabajo.",

        // Business Structure
        businessStructure: "Estructura del Negocio",
        hasBusinessEntity: "Tengo una entidad comercial registrada (LLC/Corp/Sociedad)",

        // Insurance
        insuranceCoverage: "Cobertura de Seguros",
        generalLiability: "Seguro de Responsabilidad General",
        generalLiabilityDesc: "Se requiere cobertura mínima de $1M",
        workersComp: "Seguro de Compensación de Trabajadores",
        workersCompDesc: "Requerido si tiene empleados",
        workersCompRequired: "Requerido en {{state}}",
        autoInsurance: "Seguro de Auto Comercial",
        autoInsuranceDesc: "Requerido para vehículos de servicio",
        pollutionLiability: "Seguro de Responsabilidad por Contaminación",
        pollutionLiabilityDesc: "Requerido para limpieza de instalaciones médicas",

        // File Upload
        coiLabel: "Seguro de Responsabilidad (COI)",
        coiDesc: "Debe ser válido por al menos 3 meses",
        w9Label: "Formulario W-9 del IRS",
        w9Desc: "Año fiscal más reciente",
        selectFile: "Seleccionar Archivo",
        uploaded: "Cargado",

        // Buttons
        submit: "Enviar Documentos de Cumplimiento",
        complete: "Completar Registro",
        processing: "Procesando...",

        // Success
        successTitle: "Solicitud Recibida",
        successFastTrack: "Nuestro equipo de cumplimiento está revisando sus documentos. Espere una llamada dentro de 24 horas.",
        successStandard: "Ha sido agregado a la Red de Proveedores Xiri. Lo contactaremos cuando haya trabajos que coincidan con su perfil."
    }
};

export const t = (key: string, lang: 'en' | 'es', replacements?: Record<string, string>) => {
    let text = translations[lang][key as keyof typeof translations.en] || key;

    if (replacements) {
        Object.entries(replacements).forEach(([k, v]) => {
            text = text.replace(`{{${k}}}`, v);
        });
    }

    return text;
};
