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

    // Step 2: Qualification
    step2: {
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

    // Step 3: Contact Info
    step3: {
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

    // Step 4: Documents
    step4: {
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
            title: "Welcome to Xiri Partner Network",
            subtitle: "Bienvenido a la Red de Socios de Xiri",
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
            title: "Join the Xiri Partner Network",
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
        step2: {
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
        step3: {
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
        step4: {
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
                message: "You have been added to the Xiri Supply Network. We will contact you when jobs match your profile."
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
            title: "Bienvenido a la Red de Socios de Xiri",
            subtitle: "Welcome to Xiri Partner Network",
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
            title: "Únase a la Red de Socios de Xiri",
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
        step2: {
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
        step3: {
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
        step4: {
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
                message: "Ha sido agregado a la Red de Proveedores de Xiri. Le contactaremos cuando haya trabajos que coincidan con su perfil."
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
