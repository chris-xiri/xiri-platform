/**
 * Translation file for vendor onboarding form
 * 
 * MAINTENANCE INSTRUCTIONS:
 * 1. Always update English (en) first
 * 2. Run: npm run translate:sync to auto-translate to Spanish
 * 3. Review AI translations for cultural appropriateness
 * 4. Use formal "usted" (not "tú") for all Spanish text
 * 
 * AI Translation Agent: See /scripts/translate-sync.js
 */

export type Language = 'en' | 'es';

interface Translations {
    // Language Selector (Step 0)
    languageSelector: {
        title: string;
        subtitle: string;
        english: string;
        spanish: string;
    };

    // Common
    common: {
        continue: string;
        back: string;
        submit: string;
        yes: string;
        no: string;
        optional: string;
        required: string;
        loading: string;
    };

    // Progress
    progress: {
        stepOf: string; // "Step {current} of {total}"
        complete: string; // "{percent}% Complete"
    };

    // Header
    header: {
        title: string;
        subtitle: string;
    };

    // Step 1: Track Selection
    step1: {
        title: string;
        subtitle: string;
        network: {
            title: string;
            subtitle: string;
        };
        express: {
            title: string;
            subtitle: string;
        };
    };

    // Step 2: Service Capabilities
    step2_capabilities: {
        title: string;
        subtitle: string;
        groups: {
            cleaning: string;
            facility: string;
            specialty: string;
        };
        validation: {
            selectOne: string;
        };
    };

    // Step 3: Qualification (was Step 2)
    step3_qualification: {
        title: string;
        subtitle: string;
        businessEntity: {
            question: string;
            businessNameLabel: string;
            businessNamePlaceholder: string;
        };
        generalLiability: {
            question: string;
        };
        workersComp: {
            question: string;
            requiredIn: string; // "Required in {state}"
        };
        commercialAuto: {
            question: string;
        };
        pollutionLiability: {
            question: string;
            requiredFor: string; // "Required for medical facilities"
        };
        validation: {
            answerAll: string;
        };
    };

    // Step 4: Contact Info (was Step 3)
    step4_contact: {
        title: string;
        subtitle: string;
        email: {
            label: string;
            placeholder: string;
        };
        phone: {
            label: string;
            placeholder: string;
        };
        validation: {
            invalidEmail: string;
            invalidPhone: string;
        };
    };

    // Step 5: Documents (was Step 4)
    step5_documents: {
        title: string;
        subtitle: string;
        coi: {
            label: string;
        };
        llc: {
            label: string;
        };
        w9: {
            label: string;
        };
        uploaded: string;
        validation: {
            uploadRequired: string;
        };
    };

    // Success State
    success: {
        title: string;
        network: {
            message: string;
        };
        express: {
            message: string;
        };
    };

    // Error States
    errors: {
        notFound: string;
        submissionFailed: string;
    };
}

export const translations: Record<Language, Translations> = {
    en: {
        languageSelector: {
            title: "Welcome to XIRI Partner Network",
            subtitle: "Bienvenido a la Red de Socios de XIRI",
            english: "English",
            spanish: "Español"
        },
        common: {
            continue: "Continue",
            back: "Back",
            submit: "Complete Application",
            yes: "Yes",
            no: "No",
            optional: "Optional",
            required: "Required",
            loading: "Loading..."
        },
        progress: {
            stepOf: "Step {current} of {total}",
            complete: "{percent}% Complete"
        },
        header: {
            title: "Join the XIRI Partner Network",
            subtitle: "Complete your profile to start receiving opportunities"
        },
        step1: {
            title: "What brings you here?",
            subtitle: "Choose the option that best describes your situation",
            network: {
                title: "Join Our Network",
                subtitle: "We'll actively find work that matches your services"
            },
            express: {
                title: "I Need Work Now",
                subtitle: "Jobs ready - just need your paperwork"
            }
        },
        step2_capabilities: {
            title: "What services do you offer?",
            subtitle: "Select all that apply — this helps us match you to the right jobs",
            groups: {
                cleaning: "Cleaning",
                facility: "Facility & Maintenance",
                specialty: "Specialty Trades",
            },
            validation: {
                selectOne: "Please select at least one service to continue",
            },
        },
        step3_qualification: {
            title: "Quick Qualification",
            subtitle: "Just a few Yes/No questions",
            businessEntity: {
                question: "Do you have a registered business entity (LLC/Corp)?",
                businessNameLabel: "What's your business name?",
                businessNamePlaceholder: "e.g., ABC Cleaning Services LLC"
            },
            generalLiability: {
                question: "Do you have General Liability insurance?"
            },
            workersComp: {
                question: "Do you have Workers' Compensation insurance?",
                requiredIn: "Required in {state}"
            },
            commercialAuto: {
                question: "Do you have Commercial Auto insurance?"
            },
            pollutionLiability: {
                question: "Do you have Pollution Liability insurance?",
                requiredFor: "Required for medical facilities"
            },
            validation: {
                answerAll: "Please answer all questions to continue"
            }
        },
        step4_contact: {
            title: "✓ Great! You're qualified",
            subtitle: "How can we reach you?",
            email: {
                label: "Primary Email",
                placeholder: "john@example.com"
            },
            phone: {
                label: "Phone",
                placeholder: "(555) 123-4567"
            },
            validation: {
                invalidEmail: "Please enter a valid email address",
                invalidPhone: "Please enter a valid 10-digit phone number"
            }
        },
        step5_documents: {
            title: "✓ Almost there!",
            subtitle: "Upload your documents to complete your application",
            coi: {
                label: "Certificate of Insurance (COI)"
            },
            llc: {
                label: "Business License / LLC Certificate"
            },
            w9: {
                label: "W-9 Form"
            },
            uploaded: "Uploaded successfully",
            validation: {
                uploadRequired: "Please upload COI and Business License to continue"
            }
        },
        success: {
            title: "Application Received",
            network: {
                message: "You have been added to the XIRI Supply Network. We will contact you when jobs match your profile."
            },
            express: {
                message: "Our compliance team is reviewing your documents. Expect a call within 24 hours."
            }
        },
        errors: {
            notFound: "Vendor portal not found.",
            submissionFailed: "Failed to submit application. Please try again."
        }
    },
    es: {
        languageSelector: {
            title: "Bienvenido a la Red de Socios de XIRI",
            subtitle: "Welcome to XIRI Partner Network",
            english: "English",
            spanish: "Español"
        },
        common: {
            continue: "Continuar",
            back: "Atrás",
            submit: "Completar Solicitud",
            yes: "Sí",
            no: "No",
            optional: "Opcional",
            required: "Requerido",
            loading: "Cargando..."
        },
        progress: {
            stepOf: "Paso {current} de {total}",
            complete: "{percent}% Completado"
        },
        header: {
            title: "Únase a la Red de Socios de XIRI",
            subtitle: "Complete su perfil para comenzar a recibir oportunidades"
        },
        step1: {
            title: "¿Qué le trae aquí?",
            subtitle: "Elija la opción que mejor describa su situación",
            network: {
                title: "Unirse a Nuestra Red",
                subtitle: "Encontraremos activamente trabajo que coincida con sus servicios"
            },
            express: {
                title: "Necesito Trabajo Ahora",
                subtitle: "Trabajos listos - solo necesita su documentación"
            }
        },
        step2_capabilities: {
            title: "¿Qué servicios ofrece?",
            subtitle: "Seleccione todos los que apliquen — esto nos ayuda a encontrarle los trabajos correctos",
            groups: {
                cleaning: "Limpieza",
                facility: "Mantenimiento de Instalaciones",
                specialty: "Oficios Especializados",
            },
            validation: {
                selectOne: "Por favor seleccione al menos un servicio para continuar",
            },
        },
        step3_qualification: {
            title: "Calificación Rápida",
            subtitle: "Solo algunas preguntas de Sí/No",
            businessEntity: {
                question: "¿Tiene una entidad comercial registrada (LLC/Sociedad de Responsabilidad Limitada)?",
                businessNameLabel: "¿Cuál es el nombre de su empresa?",
                businessNamePlaceholder: "ej., Servicios de Limpieza ABC LLC"
            },
            generalLiability: {
                question: "¿Tiene seguro de responsabilidad general?"
            },
            workersComp: {
                question: "¿Tiene seguro de compensación para trabajadores?",
                requiredIn: "Requerido en {state}"
            },
            commercialAuto: {
                question: "¿Tiene seguro de auto comercial?"
            },
            pollutionLiability: {
                question: "¿Tiene seguro de responsabilidad por contaminación?",
                requiredFor: "Requerido para instalaciones médicas"
            },
            validation: {
                answerAll: "Por favor responda todas las preguntas para continuar"
            }
        },
        step4_contact: {
            title: "✓ ¡Excelente! Usted califica",
            subtitle: "¿Cómo podemos contactarle?",
            email: {
                label: "Correo Electrónico Principal",
                placeholder: "juan@ejemplo.com"
            },
            phone: {
                label: "Teléfono",
                placeholder: "(555) 123-4567"
            },
            validation: {
                invalidEmail: "Por favor ingrese una dirección de correo electrónico válida",
                invalidPhone: "Por favor ingrese un número de teléfono válido de 10 dígitos"
            }
        },
        step5_documents: {
            title: "✓ ¡Casi terminamos!",
            subtitle: "Suba sus documentos para completar su solicitud",
            coi: {
                label: "Certificado de Seguro (COI)"
            },
            llc: {
                label: "Licencia Comercial / Certificado LLC"
            },
            w9: {
                label: "Formulario W-9"
            },
            uploaded: "Subido exitosamente",
            validation: {
                uploadRequired: "Por favor suba el COI y la Licencia Comercial para continuar"
            }
        },
        success: {
            title: "Solicitud Recibida",
            network: {
                message: "Ha sido agregado a la Red de Proveedores de XIRI. Le contactaremos cuando haya trabajos que coincidan con su perfil."
            },
            express: {
                message: "Nuestro equipo de cumplimiento está revisando sus documentos. Espere una llamada dentro de 24 horas."
            }
        },
        errors: {
            notFound: "Portal de proveedor no encontrado.",
            submissionFailed: "Error al enviar la solicitud. Por favor intente de nuevo."
        }
    }
};

// Helper function for string interpolation
export function t(key: string, lang: Language, params?: Record<string, string | number>): string {
    const keys = key.split('.');
    let value: any = translations[lang];

    for (const k of keys) {
        value = value?.[k];
    }

    if (typeof value !== 'string') {
        console.warn(`Translation key not found: ${key}`);
        return key;
    }

    // Replace {param} with actual values
    if (params) {
        return value.replace(/\{(\w+)\}/g, (_, paramKey) => {
            return params[paramKey]?.toString() || '';
        });
    }

    return value;
}
