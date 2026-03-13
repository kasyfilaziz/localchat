import mermaid from 'mermaid';
import svgPanZoom from 'svg-pan-zoom';

let initialized = false;
const panZoomInstances = new Map<string, ReturnType<typeof svgPanZoom>>();

export async function initMermaid(): Promise<void> {
    if (initialized) return;

    mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        themeVariables: {
            darkMode: true,
            background: '#1f2937',
            primaryColor: '#3b82f6',
            primaryTextColor: '#e5e7eb',
            primaryBorderColor: '#4b5563',
            lineColor: '#9ca3af',
            secondaryColor: '#4b5563',
            tertiaryColor: '#374151',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
        },
        flowchart: {
            curve: 'basis',
            padding: 20
        },
        sequence: {
            actorMargin: 50,
            boxMargin: 10,
            boxTextMargin: 5,
            noteMargin: 10,
            messageMargin: 35
        },
        gantt: {
            titleTopMargin: 25,
            barHeight: 20,
            barGap: 4,
            topPadding: 50
        },
        securityLevel: 'strict'
    });

    initialized = true;
}

export async function renderMermaid(code: string, id: string): Promise<string> {
    await initMermaid();

    try {
        const isValid = await mermaid.parse(code);
        if (isValid) {
            const { svg } = await mermaid.render(id, code);
            return svg;
        }
        return '';
    } catch (error) {
        console.warn('Mermaid render error:', error);
        return '';
    }
}

export function renderMermaidError(originalCode: string): string {
    return `<pre class="mermaid-raw"><code>${escapeHtml(originalCode)}</code></pre>`;
}

function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export function enablePanZoom(svgElement: SVGSVGElement, diagramId: string): void {
    if (panZoomInstances.has(diagramId)) {
        panZoomInstances.get(diagramId)?.destroy();
    }

    const instance = svgPanZoom(svgElement, {
        zoomEnabled: true,
        controlIconsEnabled: true,
        fit: true,
        center: true,
        minZoom: 0.1,
        maxZoom: 10,
        zoomScaleSensitivity: 0.5,
        mouseWheelZoomEnabled: true,
        panEnabled: true,
        preventMouseEventsDefault: true,
        touchZoomEnabled: true,
        touchPanEnabled: true,
        dblClickZoomEnabled: true
    });

    panZoomInstances.set(diagramId, instance);
}

export function disablePanZoom(diagramId: string): void {
    if (panZoomInstances.has(diagramId)) {
        panZoomInstances.get(diagramId)?.destroy();
        panZoomInstances.delete(diagramId);
    }
}
