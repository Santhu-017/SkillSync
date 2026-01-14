// public/widget.js

const teamWidget = document.getElementById('team-widget');
const widgetHandle = document.getElementById('widget-handle');
const widgetCloseBtn = document.getElementById('widget-close-btn');

// Check if elements exist before adding listeners
if (teamWidget && widgetHandle && widgetCloseBtn) {
    let isDragging = false;
    let hasDragged = false;
    let offsetX, offsetY;

    // --- Drag and Drop Logic ---
    const dragStart = (e) => {
        if (e.button === 0 || e.type === 'touchstart') { // Only drag with left mouse button or touch
            isDragging = true;
            hasDragged = false; 

            const clientX = e.clientX || e.touches[0].clientX;
            const clientY = e.clientY || e.touches[0].clientY;
            
            offsetX = clientX - teamWidget.getBoundingClientRect().left;
            offsetY = clientY - teamWidget.getBoundingClientRect().top;
            
            document.addEventListener('mousemove', dragging);
            document.addEventListener('touchmove', dragging, { passive: false });
            document.addEventListener('mouseup', dragEnd);
            document.addEventListener('touchend', dragEnd);
        }
    };

    const dragging = (e) => {
        if (!isDragging) return;
        e.preventDefault();
        hasDragged = true;

        const clientX = e.clientX || e.touches[0].clientX;
        const clientY = e.clientY || e.touches[0].clientY;

        let newX = clientX - offsetX;
        let newY = clientY - offsetY;

        const widgetRect = teamWidget.getBoundingClientRect();
        const maxX = window.innerWidth - widgetRect.width;
        const maxY = window.innerHeight - widgetRect.height;
        newX = Math.max(0, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));

        teamWidget.style.left = `${newX}px`;
        teamWidget.style.top = `${newY}px`;
        teamWidget.style.bottom = 'auto';
        teamWidget.style.right = 'auto';
    };

    const dragEnd = () => {
        isDragging = false;
        document.removeEventListener('mousemove', dragging);
        document.removeEventListener('touchmove', dragging);
        document.removeEventListener('mouseup', dragEnd);
        document.removeEventListener('touchend', dragEnd);
    };

    // --- Click and Close Logic ---
    const handleClick = () => {
        if (!hasDragged) {
            teamWidget.classList.toggle('expanded');
        }
    };

    const closeWidget = (e) => {
        e.stopPropagation(); // Prevent the click from bubbling up to the handle and re-opening
        teamWidget.classList.remove('expanded');
    };

    // --- Attach Event Listeners ---
    widgetHandle.addEventListener('mousedown', dragStart);
    widgetHandle.addEventListener('touchstart', dragStart);
    widgetHandle.addEventListener('click', handleClick);
    widgetCloseBtn.addEventListener('click', closeWidget);
}