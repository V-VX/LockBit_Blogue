/**
 * Matrix-style character scramble animation.
 * Each character randomises independently, then settles to its real value
 * at a random time between 1000–5000 ms.
 */

export function animateTextNode(node: Text): void {
    const original = node.textContent ?? '';
    if (!original.trim()) return;

    const chars = [...original];
    const settled = chars.map(c => !c.trim()); // pre-settle whitespace
    const settleTimes = chars.map(c =>
        c.trim() ? Math.floor(Math.random() * (4000 - 1000 + 1)) + 1000 : 0,
    );
    const start = Date.now();

    const timer = setInterval(() => {
        const elapsed = Date.now() - start;
        let allDone = true;

        for (let i = 0; i < chars.length; i++) {
            if (!settled[i]) {
                if (elapsed >= settleTimes[i]) {
                    settled[i] = true;
                    chars[i] = original[i] ?? '';
                } else {
                    chars[i] = String.fromCharCode(Math.floor(Math.random() * (126 - 33 + 1)) + 33);
                    allDone = false;
                }
            }
        }

        node.textContent = chars.join('');
        if (allDone) clearInterval(timer);
    }, 100);
}

export function animateElement(root: Element): void {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    let n: Node | null;
    while ((n = walker.nextNode())) nodes.push(n as Text);
    nodes.forEach(animateTextNode);
}
