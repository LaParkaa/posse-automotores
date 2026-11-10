import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ResumenBotWeb } from "@/lib/bot/web/estadisticas";
import type { ConversacionResumen } from "@/lib/conversaciones";
import { ChatConversacion } from "./chat-conversacion";
import { ListaConversaciones } from "./lista-conversaciones";
import { ResumenBotWebVista } from "./resumen-bot-web";

const resumenVacio: ResumenBotWeb = {
  embudo: { vieronPagina: 0, abrieron: 0, interactuaron: 0, armaronMensaje: 0, tocaronWhatsapp: 0 },
  conversaciones: 0,
  mensajesPorConversacion: null,
  dejaronDatos: 0,
  autosMasConsultados: [],
  noEntendidos: [],
  comparacion: { simulaciones: 0, mensajesArmados: 0, toquesWhatsappChat: 0 },
  porDia: [{ dia: "2026-11-09", etiqueta: "9 nov", personas: 0 }],
};

const conv = (parcial: Partial<ConversacionResumen>): ConversacionResumen => ({
  id: "3f2b9c1e-aaaa-4bbb-8ccc-1234567890ab",
  nombre: "Visitante",
  usuario: null,
  mensajes: 3,
  primerMensaje: "2026-11-09T15:00:00.000Z",
  ultimoMensaje: "2026-11-09T15:05:00.000Z",
  ultimoTexto: "gracias",
  ultimoEsDelCliente: true,
  noEntendidos: 0,
  postulo: false,
  dejoDatos: false,
  ...parcial,
});

describe("ListaConversaciones", () => {
  it("por defecto es Instagram: links sin canal, con Postulaciones y rótulos de siempre", () => {
    const html = renderToStaticMarkup(<ListaConversaciones conversaciones={[conv({ id: "123456789" })]} filtro="todas" dias={30} />);
    expect(html).toContain('href="/admin/conversaciones/123456789"');
    expect(html).toContain('href="/admin/conversaciones?dias=30&amp;filtro=postulaciones"');
    expect(html).not.toContain("canal=web");
    expect(html).toContain("Cliente: ");
  });

  it("en la web lleva canal=web en filtros y detalle, y oculta Postulaciones", () => {
    const html = renderToStaticMarkup(<ListaConversaciones conversaciones={[conv({})]} filtro="todas" dias={7} canal="web" />);
    expect(html).toContain('href="/admin/conversaciones/3f2b9c1e-aaaa-4bbb-8ccc-1234567890ab?canal=web"');
    expect(html).toContain('href="/admin/conversaciones?dias=7&amp;filtro=fallas&amp;canal=web"');
    expect(html).not.toContain("Postulaciones");
    expect(html).toContain("Visitante: ");
  });

  it("la web ofrece el filtro Dejaron sus datos y marca la conversación que los dejó", () => {
    const html = renderToStaticMarkup(<ListaConversaciones conversaciones={[conv({ dejoDatos: true })]} filtro="datos" dias={7} canal="web" />);
    expect(html).toContain('href="/admin/conversaciones?dias=7&amp;filtro=datos&amp;canal=web"');
    expect(html).toContain("Dejó sus datos");
  });

  it("el estado vacío de la web se lee bien", () => {
    const html = renderToStaticMarkup(<ListaConversaciones conversaciones={[]} filtro="todas" dias={30} canal="web" />);
    expect(html).toContain("Todavía no hay conversaciones del asistente en este período.");
  });
});

describe("ResumenBotWebVista", () => {
  it("sin datos muestra el embudo completo en ceros y no rompe", () => {
    const html = renderToStaticMarkup(<ResumenBotWebVista resumen={resumenVacio} titulo="Cuánta gente capta el asistente" />);
    for (const texto of [
      "Vieron la página",
      "Abrieron el chat",
      "Escribieron o tocaron una opción",
      "Armaron el mensaje para Marcos",
      "Enviar por WhatsApp",
      "Autos por los que más preguntan",
      "Lo que el asistente no entendió",
      "Personas por día",
      "0 simulaciones",
    ]) {
      expect(html).toContain(texto);
    }
    expect(html).not.toContain("NaN");
  });

  it("muestra los números, el nombre del auto y el link a la pestaña web", () => {
    const resumen: ResumenBotWeb = {
      ...resumenVacio,
      embudo: { vieronPagina: 40, abrieron: 10, interactuaron: 6, armaronMensaje: 3, tocaronWhatsapp: 2 },
      conversaciones: 6,
      mensajesPorConversacion: 2.5,
      autosMasConsultados: [{ slug: "vento-2014", conversaciones: 4 }],
      noEntendidos: [{ texto: "tenés hilux", veces: 2 }],
      comparacion: { simulaciones: 5, mensajesArmados: 3, toquesWhatsappChat: 2 },
    };
    const html = renderToStaticMarkup(
      <ResumenBotWebVista resumen={resumen} titulo="Bot de la página" verConversaciones nombresAutos={{ "vento-2014": "Volkswagen Vento 2014" }} />,
    );
    expect(html).toContain("Volkswagen Vento 2014");
    expect(html).toContain("tenés hilux");
    expect(html).toContain("2 veces");
    expect(html).toContain("5 simulaciones");
    expect(html).toContain("3 mensajes");
    expect(html).toContain("2,5");
    expect(html).toContain('href="/admin/conversaciones?canal=web"');
  });

  it("en modo compacto deja solo los números y el embudo", () => {
    const html = renderToStaticMarkup(<ResumenBotWebVista resumen={resumenVacio} titulo="Bot de la página" compacto verConversaciones />);
    expect(html).toContain("Abrieron el chat");
    expect(html).not.toContain("Personas por día");
    expect(html).not.toContain("Lo que el asistente no entendió");
  });
});

describe("ChatConversacion", () => {
  const mensajes = [
    { ig_user_id: "x", role: "user" as const, content: "bmw", created_at: "2026-11-09T15:00:00.000Z", nota: "no_entendido" },
    { ig_user_id: "x", role: "assistant" as const, content: "hola", created_at: "2026-11-09T15:00:05.000Z", nota: null },
  ];
  it("Instagram sigue diciendo Cliente y Bot", () => {
    const html = renderToStaticMarkup(<ChatConversacion mensajes={mensajes} />);
    expect(html).toContain("Cliente ·");
    expect(html).toContain("Bot ·");
    expect(html).toContain("El bot no entendió este mensaje");
  });
  it("la web dice Visitante y Asistente", () => {
    const html = renderToStaticMarkup(<ChatConversacion mensajes={mensajes} canal="web" />);
    expect(html).toContain("Visitante ·");
    expect(html).toContain("Asistente ·");
    expect(html).toContain("El asistente no entendió este mensaje");
  });
});
