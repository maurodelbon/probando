/* Tareas iniciales de Mauro: se cargan solas la primera vez que se abre la app. */
const SEED = {
 "format": "asistentes-import-1",
 "dailyGoalMin": 400,
 "categories": [
  {
   "name": "Hábitos"
  },
  {
   "name": "Saxo"
  },
  {
   "name": "Tai chi"
  },
  {
   "name": "Canto"
  },
  {
   "name": "Idiomas"
  },
  {
   "name": "Aprendizaje"
  },
  {
   "name": "Parapipou"
  },
  {
   "name": "Vibralta"
  },
  {
   "name": "Charbonier"
  },
  {
   "name": "Centro vecinal"
  },
  {
   "name": "Perros"
  },
  {
   "name": "Hogar"
  },
  {
   "name": "Construcción y Patio"
  },
  {
   "name": "General"
  },
  {
   "name": "Compras"
  },
  {
   "name": "Salud"
  },
  {
   "name": "Tesis"
  },
  {
   "name": "Recreo"
  }
 ],
 "activities": [
  {
   "key": "a-meditación",
   "name": "Meditación",
   "category": "Hábitos",
   "notes": ""
  },
  {
   "key": "a-estiramiento",
   "name": "Estiramiento",
   "category": "Hábitos",
   "notes": ""
  },
  {
   "key": "a-ejercicio",
   "name": "Ejercicio",
   "category": "Hábitos",
   "notes": ""
  },
  {
   "key": "a-trote",
   "name": "Trote",
   "category": "Hábitos",
   "notes": "Sin días fijos: lo hacés cuando sale.",
   "days": []
  },
  {
   "key": "a-canto",
   "name": "Canto",
   "category": "Canto",
   "notes": ""
  },
  {
   "key": "a-tai-chi",
   "name": "Tai chi",
   "category": "Tai chi",
   "notes": ""
  },
  {
   "key": "a-saxo",
   "name": "Saxo",
   "category": "Saxo",
   "notes": "Martes y jueves.",
   "days": [
    2,
    4
   ]
  },
  {
   "key": "a-chino",
   "name": "Chino",
   "category": "Idiomas",
   "notes": ""
  },
  {
   "key": "a-inglés",
   "name": "Inglés",
   "category": "Idiomas",
   "notes": ""
  },
  {
   "key": "a-parapipou",
   "name": "Parapipou",
   "category": "Parapipou",
   "notes": ""
  },
  {
   "key": "a-vibralta",
   "name": "Vibralta",
   "category": "Vibralta",
   "notes": ""
  },
  {
   "key": "a-charbonier",
   "name": "Charbonier",
   "category": "Charbonier",
   "notes": ""
  },
  {
   "key": "a-perros",
   "name": "Perros",
   "category": "Perros",
   "notes": "Lunes y miércoles.",
   "days": [
    1,
    3
   ]
  },
  {
   "key": "a-orden-digital",
   "name": "Orden digital",
   "category": "Hogar",
   "notes": "2 bloques por semana, sin día fijo."
  },
  {
   "key": "a-limpieza",
   "name": "Limpieza",
   "category": "Hogar",
   "notes": "Baño los domingos; el resto, flotante."
  },
  {
   "key": "a-recreo",
   "name": "Recreo",
   "category": "Recreo"
  }
 ],
 "tasks": [
  {
   "key": "t-pileta",
   "name": "Arreglar la pileta del patio",
   "category": "Construcción y Patio",
   "priority": "high",
   "date": "",
   "notes": "Prioridad alta, en este orden.",
   "subtasks": [
    {
     "key": "t-pileta-1",
     "name": "Terminar de vaciarla"
    },
    {
     "key": "t-pileta-2",
     "name": "Limpiarla"
    },
    {
     "key": "t-pileta-3",
     "name": "Lijarla"
    },
    {
     "key": "t-pileta-4",
     "name": "Pintarla (antes revisar clima y tiempo de secado)"
    }
   ]
  },
  {
   "key": "t-speech",
   "name": "Revisar el speech de Parapipou (5 minutos)",
   "category": "Parapipou",
   "priority": "high",
   "date": "",
   "notes": "Revisar el speech completo, no solo sumar la anécdota personal. Varias pasadas hasta dejarlo listo."
  },
  {
   "key": "t-seba",
   "name": "Mandarle a Seba las canciones para mezclar",
   "category": "Parapipou",
   "priority": "normal",
   "date": "2026-10-28",
   "notes": ""
  },
  {
   "key": "t-ensayo",
   "name": "Preguntar a los chicos (Parapipou) si pueden ensayar en enero",
   "category": "Parapipou",
   "priority": "normal",
   "date": "2026-10-29",
   "notes": "Ensayo tentativo 11, 12 y 13 de enero. Si confirman, pasar los eventos del calendario a confirmados."
  },
  {
   "key": "t-cesar",
   "name": "Preguntarle a César a qué hora es lo del sábado 31/10",
   "category": "Charbonier",
   "priority": "normal",
   "date": "",
   "notes": "Para coordinar con Belén, que también tiene un evento ese día."
  },
  {
   "key": "t-vibralta-negocio",
   "name": "Armar el negocio de Vibralta con Belén",
   "category": "Vibralta",
   "priority": "normal",
   "date": "",
   "notes": "Proyecto de alimentación saludable. Sentarse esta semana a armarlo."
  },
  {
   "key": "t-partido",
   "name": "Crear el partido vecinal y presentarse a elecciones (marzo 2027)",
   "category": "Charbonier",
   "priority": "normal",
   "date": "",
   "notes": "Fecha real de elecciones a confirmar."
  },
  {
   "key": "t-cuarto-afuera",
   "name": "Obra del cuarto (afuera)",
   "category": "Construcción y Patio",
   "priority": "normal",
   "date": "",
   "notes": "Antes de cerrar el techo, resolver pases de caños y cables.",
   "subtasks": [
    {
     "key": "t-cuarto-afuera-1",
     "name": "Levantar la pared de frente"
    },
    {
     "key": "t-cuarto-afuera-2",
     "name": "Ponerle 2 ventanas"
    },
    {
     "key": "t-cuarto-afuera-3",
     "name": "Levantar la pared de atrás"
    },
    {
     "key": "t-cuarto-afuera-4",
     "name": "Puerta de los perros"
    }
   ]
  },
  {
   "key": "t-maderas",
   "name": "Calcular maderas para el techo",
   "category": "Construcción y Patio",
   "priority": "normal",
   "date": "",
   "notes": "",
   "subtasks": [
    {
     "key": "t-maderas-1",
     "name": "Calcular cuántas se necesitan"
    },
    {
     "key": "t-maderas-2",
     "name": "Escribir a la maderera"
    },
    {
     "key": "t-maderas-3",
     "name": "Conseguir presupuesto"
    },
    {
     "key": "t-maderas-4",
     "name": "Ir a comprarlas"
    }
   ]
  },
  {
   "key": "t-chapas",
   "name": "Comprar chapas para el techo",
   "category": "Construcción y Patio",
   "priority": "normal",
   "date": "",
   "notes": "",
   "subtasks": [
    {
     "key": "t-chapas-1",
     "name": "Calcular cuántas chapas"
    },
    {
     "key": "t-chapas-2",
     "name": "Pedir presupuesto a Bergamasco"
    },
    {
     "key": "t-chapas-3",
     "name": "Ir a buscarlas"
    }
   ]
  },
  {
   "key": "t-puerta",
   "name": "Comprar la puerta interna del living",
   "category": "Construcción y Patio",
   "priority": "normal",
   "date": "",
   "notes": "",
   "subtasks": [
    {
     "key": "t-puerta-1",
     "name": "Averiguar dónde ver puertas (Cruz del Eje y Córdoba)"
    },
    {
     "key": "t-puerta-2",
     "name": "Conseguir presupuestos"
    },
    {
     "key": "t-puerta-3",
     "name": "Ir a buscarla"
    },
    {
     "key": "t-puerta-4",
     "name": "Hacer el agujero en la pared"
    },
    {
     "key": "t-puerta-5",
     "name": "Comprar el producto para fijarla"
    },
    {
     "key": "t-puerta-6",
     "name": "Ponerla"
    }
   ]
  },
  {
   "key": "t-portal",
   "name": "Construir el portal del living",
   "category": "Construcción y Patio",
   "priority": "normal",
   "date": "",
   "notes": "Ya lo hablaste con Belén. Falta probar la madera y los ladrillos que ya tienen."
  },
  {
   "key": "t-ladrillera",
   "name": "Ir a la ladrillera a filmar y comprar ladrillos",
   "category": "Construcción y Patio",
   "priority": "normal",
   "date": "",
   "notes": "CONFIRMAR: figuraba para el 27/10 y no consta si se hizo."
  },
  {
   "key": "t-puente",
   "name": "Puente",
   "category": "Construcción y Patio",
   "priority": "normal",
   "date": "",
   "notes": "Subtareas a definir.",
   "subtasks": [
    {
     "key": "t-puente-1",
     "name": "Terminar el piso del puente"
    },
    {
     "key": "t-puente-2",
     "name": "Hacer el cantero del puente"
    }
   ]
  },
  {
   "key": "t-ranger",
   "name": "Ford Ranger 2004",
   "category": "General",
   "priority": "normal",
   "date": "",
   "notes": "",
   "subtasks": [
    {
     "key": "t-ranger-1",
     "name": "Llevar a arreglar el tanque de agua"
    },
    {
     "key": "t-ranger-2",
     "name": "Cambio de aceite"
    },
    {
     "key": "t-ranger-3",
     "name": "Cambio del filtro de aire y del de combustible"
    }
   ]
  },
  {
   "key": "t-sangre",
   "name": "Análisis de sangre",
   "category": "Salud",
   "priority": "normal",
   "date": "",
   "notes": "Lo primero de salud. Sin fecha."
  },
  {
   "key": "t-cadenas",
   "name": "Buscar las cadenas",
   "category": "General",
   "priority": "normal",
   "date": "",
   "notes": "",
   "subtasks": [
    {
     "key": "t-cadenas-1",
     "name": "Pedirle las cadenas a Dani"
    },
    {
     "key": "t-cadenas-2",
     "name": "Ponerlas en la motosierra"
    }
   ]
  },
  {
   "key": "t-correo",
   "name": "Ir al correo a retirar algo y llevarle a Rocío el frasco de trigo sarraceno orgánico",
   "category": "General",
   "priority": "normal",
   "date": "",
   "notes": "Hacerlo en el mismo viaje."
  },
  {
   "key": "t-marcelo",
   "name": "Filmarle el video y armarle el Instagram a Marcelo de Escobas",
   "category": "General",
   "priority": "normal",
   "date": "",
   "notes": ""
  },
  {
   "key": "t-peregrino",
   "name": "Hablar con Belén del Peregrino",
   "category": "General",
   "priority": "normal",
   "date": "",
   "notes": ""
  },
  {
   "key": "t-acequia-lista",
   "name": "Armar el listado de tareas de mantenimiento de la acequia",
   "category": "Centro vecinal",
   "priority": "normal",
   "date": "",
   "notes": "Por ahora: abrirla un sábado por medio y revisar la pérdida de agua. Faltan las demás."
  },
  {
   "key": "t-tesis",
   "name": "Presentar la tesis de Relaciones Internacionales",
   "category": "Tesis",
   "priority": "normal",
   "date": "",
   "notes": "IMPORTANTE. Es en 2027. Falta definir el tema; después se arma la subdivisión de tareas."
  }
 ],
 "dates": [
  {
   "key": "d-ensayo",
   "name": "Ensayo Parapipou (tentativo, 11 al 13 de enero)",
   "date": "2027-01-11",
   "kind": "event",
   "note": "Días 11, 12 y 13. Si confirman los chicos, pasar los eventos del calendario a confirmados."
  },
  {
   "key": "d-elecciones",
   "name": "Elecciones Charbonier (fecha estimada)",
   "date": "2027-03-01",
   "kind": "event",
   "note": "Confirmar la fecha real."
  },
  {
   "key": "d-show",
   "name": "Show de Parapipou en el CAFF (puertas 20 hs)",
   "date": "2027-03-13",
   "kind": "event",
   "note": "Sánchez de Bustamante 772, Almagro."
  },
  {
   "key": "d-nueva-politica",
   "name": "Coordinar con Nueva Política (Comuna)",
   "date": "2026-10-30",
   "kind": "event"
  },
  {
   "key": "d-emergencias",
   "name": "Jornada de preparación ante emergencias, SUM de Charbonier (10 a 16)",
   "date": "2026-10-31",
   "kind": "event"
  }
 ]
};
