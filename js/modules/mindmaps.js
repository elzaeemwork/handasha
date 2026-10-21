/**
 * mindmaps.js - الخرائط الذهنية الهندسية
 * Interactive mind-map tree editor with node dragging, SVG connectors, and zoom/pan.
 * @module modules/mindmaps
 */

import { add, get, getAll, update, remove } from '../db/database.js';
import { icon } from '../utils/icons.js';
import { toast, confirm, modal, emptyState, loadingSpinner } from '../utils/ui.js';
import { sanitizeHTML } from '../utils/validation.js';
import { navigate } from '../router.js';

export async function render(container, params) {
  const mapId = params?.id;
  if (mapId) {
    await renderMindmapEditor(container, mapId);
  } else {
    await renderMindmapsList(container);
  }
}

async function renderMindmapsList(container) {
  container.innerHTML = loadingSpinner('جاري تحميل الخرائط الذهنية...');

  async function loadData() {
    const [maps, subjects] = await Promise.all([getAll('mindmaps'), getAll('subjects')]);
    return { maps: maps || [], subjects: subjects || [] };
  }

  function renderView(data) {
    const { maps, subjects } = data;
    const subjectsMap = new Map(subjects.map((s) => [s.id, s]));

    container.innerHTML = `
      <div class="flashcards-container">
        <!-- Header -->
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div>
            <h2 style="font-size: 20px; font-weight: 700; color: var(--color-text); margin: 0;">الخرائط الذهنية</h2>
            <span style="font-size: 13px; color: var(--color-text-secondary);">ربط المفاهيم الهندسية والمصطلحات شجرياً</span>
          </div>
          <button id="btn-add-mindmap" class="btn btn-primary" style="display: inline-flex; align-items: center; gap: 6px;">
            ${icon('plus', 18)}
            <span>خريطة جديدة</span>
          </button>
        </div>

        <!-- Mindmaps Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; margin-top: 6px;">
          ${
            maps.length === 0
              ? emptyState(
                  'brain',
                  'لا توجد خرائط ذهنية',
                  'أنشئ خريطة ذهنية لتوضيح تفرع مادة هندسية أو تلخيص موضوع معقد.',
                  'إنشاء خريطة ذهنية',
                  () => openMindmapForm(null, data)
                )
              : maps
                  .map((m) => {
                    const subj = subjectsMap.get(m.subjectId);
                    const subjName = subj ? subj.name : 'عام';
                    const subjColor = subj ? subj.color : '#8b5cf6';
                    let nodeCount = 1;
                    try {
                      const parsed = typeof m.data === 'string' ? JSON.parse(m.data) : m.data;
                      if (parsed?.nodes) nodeCount = parsed.nodes.length;
                    } catch (e) {}

                    return `
                    <div class="card mindmap-card" data-id="${m.id}" style="cursor: pointer; border-right: 4px solid ${subjColor}; display: flex; flex-direction: column; gap: 10px;">
                      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div>
                          <div style="font-size: 16px; font-weight: 700; color: var(--color-text);">${sanitizeHTML(m.title)}</div>
                          <span class="badge" style="background: ${subjColor}15; color: ${subjColor}; font-weight: 600; font-size: 11px; margin-top: 4px;">${sanitizeHTML(subjName)}</span>
                        </div>
                        <button class="btn btn-ghost btn-delete-mindmap" data-id="${m.id}" style="padding: 4px; color: var(--color-danger);" title="حذف">
                          ${icon('trash', 16)}
                        </button>
                      </div>

                      <div style="font-size: 12px; color: var(--color-text-secondary);">
                        عدد العقد والمفاهيم: <b>${nodeCount}</b>
                      </div>
                    </div>
                  `;
                  })
                  .join('')
          }
        </div>
      </div>
    `;

    container.querySelector('#btn-add-mindmap').addEventListener('click', () => {
      openMindmapForm(null, data);
    });

    container.querySelectorAll('.mindmap-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.btn-delete-mindmap')) return;
        navigate(`/mindmaps/${card.dataset.id}`);
      });
    });

    container.querySelectorAll('.btn-delete-mindmap').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const ok = await confirm('حذف الخريطة الذهنية', 'هل أنت متأكد من حذف هذه الخريطة؟', 'حذف', 'إلغاء', true);
        if (ok) {
          await remove('mindmaps', btn.dataset.id);
          toast('تم حذف الخريطة الذهنية', 'success');
          const updated = await loadData();
          renderView(updated);
        }
      });
    });
  }

  function openMindmapForm(mapItem, data) {
    const { subjects } = data;
    const formHTML = `
      <form id="mindmap-form" style="display: flex; flex-direction: column; gap: 14px; direction: rtl;">
        <div>
          <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">عنوان الخريطة (الفكرة المركزية) *</label>
          <input type="text" name="title" placeholder="مثال: منظومات الاتصالات الرقمية" required style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-bg); font-size: 14px;" />
        </div>
        <div>
          <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">المادة الدراسية</label>
          <select name="subjectId" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-bg); font-size: 14px;">
            <option value="">(عام)</option>
            ${subjects.map((s) => `<option value="${s.id}">${sanitizeHTML(s.name)}</option>`).join('')}
          </select>
        </div>
      </form>
    `;

    modal('إنشاء خريطة ذهنية جديدة', formHTML, [
      {
        text: 'إنشاء الخريطة',
        className: 'btn btn-primary',
        onClick: async (closeFn) => {
          const form = document.getElementById('mindmap-form');
          const title = form.title.value.trim();
          if (!title) {
            toast('يرجى كتابة عنوان للخريطة', 'warning');
            return;
          }

          const rootId = 'node-' + Math.random().toString(36).substr(2, 7);
          const initialData = {
            rootId,
            nodes: [
              {
                id: rootId,
                parentId: null,
                text: title,
                x: 400,
                y: 300,
                color: '#3657C8',
              },
            ],
          };

          const newId = await add('mindmaps', {
            title,
            subjectId: form.subjectId.value || '',
            data: JSON.stringify(initialData),
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });

          toast('تم إنشاء الخريطة بنجاح', 'success');
          closeFn();
          navigate(`/mindmaps/${newId}`);
        },
      },
    ]);
  }

  const initialData = await loadData();
  renderView(initialData);
}

async function renderMindmapEditor(container, mapId) {
  container.innerHTML = loadingSpinner('جاري فتح الخريطة الذهنية...');

  const mapRecord = await get('mindmaps', mapId);
  if (!mapRecord) {
    toast('الخريطة غير موجودة', 'error');
    navigate('/mindmaps');
    return;
  }

  let graphData = { rootId: 'node-root', nodes: [] };
  try {
    graphData = typeof mapRecord.data === 'string' ? JSON.parse(mapRecord.data) : mapRecord.data;
  } catch (e) {
    graphData = {
      rootId: 'node-root',
      nodes: [{ id: 'node-root', parentId: null, text: mapRecord.title, x: 400, y: 300, color: '#3657C8' }],
    };
  }

  let selectedNodeId = graphData.rootId;
  let zoom = 1;
  let saveTimer = null;

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; height: 100%; position: relative;">
      <!-- Toolbar -->
      <div style="background: var(--color-card); border-bottom: 1px solid var(--color-border); padding: 8px 14px; display: flex; align-items: center; justify-content: space-between; z-index: 10;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <button id="btn-back-maps" class="btn btn-ghost" style="padding: 6px 10px; display: inline-flex; align-items: center; gap: 4px;">
            ${icon('chevron-right', 20)}
            <span>الخرائط</span>
          </button>
          <span style="font-weight: 700; font-size: 15px; color: var(--color-text);">${sanitizeHTML(mapRecord.title)}</span>
        </div>

        <div style="display: flex; align-items: center; gap: 6px;">
          <button id="btn-add-child" class="btn btn-primary btn-sm" style="display: inline-flex; align-items: center; gap: 4px;">
            ${icon('plus', 16)}
            <span>تفرع جديد</span>
          </button>
          <button id="btn-auto-layout" class="btn btn-secondary btn-sm" title="ترتيب تلقائي">
            ${icon('sort', 16)}
          </button>
          <button id="btn-zoom-in" class="btn btn-secondary btn-sm" title="تكبير">+</button>
          <button id="btn-zoom-out" class="btn btn-secondary btn-sm" title="تصغير">-</button>
        </div>
      </div>

      <!-- Mindmap Viewport -->
      <div class="mindmap-viewport" id="mindmap-viewport">
        <div class="mindmap-canvas" id="mindmap-canvas">
          <svg id="mindmap-svg-lines" style="position: absolute; top:0; left:0; width:100%; height:100%; pointer-events: none;"></svg>
          <div id="mindmap-nodes-container"></div>
        </div>
      </div>

      <!-- Bottom Hint -->
      <div style="position: absolute; bottom: 12px; right: 12px; background: rgba(0,0,0,0.6); color: #fff; padding: 6px 12px; border-radius: 20px; font-size: 11px; pointer-events: none; z-index: 10;">
        اسحب العقد للتحريك • انقر لتحديد عقدة والتفرع منها
      </div>
    </div>
  `;

  const canvas = container.querySelector('#mindmap-canvas');
  const svgLines = container.querySelector('#mindmap-svg-lines');
  const nodesBox = container.querySelector('#mindmap-nodes-container');

  function renderNodesAndLines() {
    nodesBox.innerHTML = '';
    svgLines.innerHTML = '';

    const nodesMap = new Map(graphData.nodes.map((n) => [n.id, n]));

    // Draw lines
    graphData.nodes.forEach((node) => {
      if (node.parentId && nodesMap.has(node.parentId)) {
        const parent = nodesMap.get(node.parentId);
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        // Bezier curve connector
        const startX = parent.x + 80;
        const startY = parent.y + 20;
        const endX = node.x;
        const endY = node.y + 20;
        const cx1 = startX + (endX - startX) / 2;
        const cy1 = startY;
        const cx2 = startX + (endX - startX) / 2;
        const cy2 = endY;
        const d = `M ${startX} ${startY} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${endX} ${endY}`;

        line.setAttribute('d', d);
        line.setAttribute('fill', 'none');
        line.setAttribute('stroke', node.color || '#3657C8');
        line.setAttribute('stroke-width', '2.5');
        line.setAttribute('stroke-linecap', 'round');
        svgLines.appendChild(line);
      }
    });

    // Draw Nodes
    graphData.nodes.forEach((node) => {
      const nodeEl = document.createElement('div');
      const isRoot = node.id === graphData.rootId;
      const isSelected = node.id === selectedNodeId;

      nodeEl.className = `mindmap-node ${isRoot ? 'root-node' : ''}`;
      nodeEl.style.left = `${node.x}px`;
      nodeEl.style.top = `${node.y}px`;
      nodeEl.style.borderColor = node.color || '#3657C8';
      if (isSelected && !isRoot) {
        nodeEl.style.boxShadow = '0 0 0 3px rgba(54, 87, 200, 0.4)';
      }

      nodeEl.innerHTML = `
        <span>${sanitizeHTML(node.text)}</span>
        <div style="display: flex; gap: 2px;">
          <button class="node-edit-btn" style="background: none; border: none; cursor: pointer; color: inherit; padding: 2px;">
            ${icon('edit', 14)}
          </button>
          ${
            !isRoot
              ? `<button class="node-del-btn" style="background: none; border: none; cursor: pointer; color: #D9534F; padding: 2px;">
                  ${icon('x', 14)}
                 </button>`
              : ''
          }
        </div>
      `;

      // Select node on click
      nodeEl.addEventListener('click', (e) => {
        if (e.target.closest('.node-edit-btn') || e.target.closest('.node-del-btn')) return;
        selectedNodeId = node.id;
        renderNodesAndLines();
      });

      // Edit node text
      nodeEl.querySelector('.node-edit-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        openEditNodeModal(node);
      });

      // Delete node
      const delBtn = nodeEl.querySelector('.node-del-btn');
      if (delBtn) {
        delBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const ok = await confirm('حذف الفرع', `هل تريد حذف العقدة "${node.text}" وتفرعاتها؟`, 'حذف', 'إلغاء', true);
          if (ok) {
            deleteNodeRecursive(node.id);
            if (selectedNodeId === node.id) selectedNodeId = graphData.rootId;
            queueSave();
            renderNodesAndLines();
          }
        });
      }

      // Drag node logic
      setupNodeDrag(nodeEl, node);

      nodesBox.appendChild(nodeEl);
    });
  }

  function setupNodeDrag(el, node) {
    let startX = 0;
    let startY = 0;
    let initialNodeX = 0;
    let initialNodeY = 0;
    let dragging = false;

    function onPointerDown(e) {
      if (e.target.closest('button')) return;
      dragging = true;
      startX = e.clientX || e.touches?.[0]?.clientX;
      startY = e.clientY || e.touches?.[0]?.clientY;
      initialNodeX = node.x;
      initialNodeY = node.y;

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    }

    function onPointerMove(e) {
      if (!dragging) return;
      const clientX = e.clientX || e.touches?.[0]?.clientX;
      const clientY = e.clientY || e.touches?.[0]?.clientY;
      const dx = (clientX - startX) / zoom;
      const dy = (clientY - startY) / zoom;

      node.x = Math.max(20, initialNodeX + dx);
      node.y = Math.max(20, initialNodeY + dy);
      el.style.left = `${node.x}px`;
      el.style.top = `${node.y}px`;

      // Fast redraw lines
      renderLinesOnly();
    }

    function onPointerUp() {
      if (dragging) {
        dragging = false;
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        queueSave();
      }
    }

    el.addEventListener('pointerdown', onPointerDown);
  }

  function renderLinesOnly() {
    svgLines.innerHTML = '';
    const nodesMap = new Map(graphData.nodes.map((n) => [n.id, n]));

    graphData.nodes.forEach((node) => {
      if (node.parentId && nodesMap.has(node.parentId)) {
        const parent = nodesMap.get(node.parentId);
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const startX = parent.x + 80;
        const startY = parent.y + 20;
        const endX = node.x;
        const endY = node.y + 20;
        const cx1 = startX + (endX - startX) / 2;
        const cy1 = startY;
        const cx2 = startX + (endX - startX) / 2;
        const cy2 = endY;
        const d = `M ${startX} ${startY} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${endX} ${endY}`;

        line.setAttribute('d', d);
        line.setAttribute('fill', 'none');
        line.setAttribute('stroke', node.color || '#3657C8');
        line.setAttribute('stroke-width', '2.5');
        line.setAttribute('stroke-linecap', 'round');
        svgLines.appendChild(line);
      }
    });
  }

  function deleteNodeRecursive(nodeId) {
    const toDelete = new Set([nodeId]);
    let added = true;
    while (added) {
      added = false;
      graphData.nodes.forEach((n) => {
        if (n.parentId && toDelete.has(n.parentId) && !toDelete.has(n.id)) {
          toDelete.add(n.id);
          added = true;
        }
      });
    }
    graphData.nodes = graphData.nodes.filter((n) => !toDelete.has(n.id));
  }

  function openEditNodeModal(node) {
    const formHTML = `
      <div style="display: flex; flex-direction: column; gap: 12px; direction: rtl;">
        <label style="font-size: 13px; font-weight: 600;">نص العقدة:</label>
        <input type="text" id="edit-node-text" value="${sanitizeHTML(node.text)}" style="padding: 10px; border-radius: 8px; border: 1px solid var(--color-border); font-size: 14px;" />
      </div>
    `;

    modal('تعديل نص العقدة', formHTML, [
      {
        text: 'حفظ',
        className: 'btn btn-primary',
        onClick: (closeFn) => {
          const val = document.getElementById('edit-node-text').value.trim();
          if (val) {
            node.text = val;
            queueSave();
            renderNodesAndLines();
          }
          closeFn();
        },
      },
    ]);
  }

  function autoLayout() {
    const root = graphData.nodes.find((n) => n.id === graphData.rootId);
    if (!root) return;

    root.x = 80;
    root.y = 350;

    const childrenMap = new Map();
    graphData.nodes.forEach((n) => {
      if (n.parentId) {
        if (!childrenMap.has(n.parentId)) childrenMap.set(n.parentId, []);
        childrenMap.get(n.parentId).push(n);
      }
    });

    let currentY = 100;
    function layoutSubtree(node, level) {
      const children = childrenMap.get(node.id) || [];
      if (children.length === 0) {
        node.y = currentY;
        currentY += 80;
        return;
      }

      children.forEach((child) => {
        child.x = node.x + 220;
        layoutSubtree(child, level + 1);
      });

      // Center parent vertically relative to children
      const firstChildY = children[0].y;
      const lastChildY = children[children.length - 1].y;
      node.y = Math.round((firstChildY + lastChildY) / 2);
    }

    const rootChildren = childrenMap.get(root.id) || [];
    rootChildren.forEach((child) => {
      child.x = root.x + 240;
      layoutSubtree(child, 1);
    });

    if (rootChildren.length > 0) {
      root.y = Math.round((rootChildren[0].y + rootChildren[rootChildren.length - 1].y) / 2);
    }

    queueSave();
    renderNodesAndLines();
  }

  function queueSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      mapRecord.data = JSON.stringify(graphData);
      mapRecord.updatedAt = Date.now();
      await update('mindmaps', mapRecord);
    }, 1000);
  }

  // Toolbar Actions
  container.querySelector('#btn-back-maps').addEventListener('click', () => {
    navigate('/mindmaps');
  });

  container.querySelector('#btn-add-child').addEventListener('click', () => {
    const parentNode = graphData.nodes.find((n) => n.id === selectedNodeId) || graphData.nodes[0];
    const newId = 'node-' + Math.random().toString(36).substr(2, 7);
    const colors = ['#3657C8', '#24A58A', '#E8A23A', '#8b5cf6', '#ec4899', '#06b6d4'];
    const chosenColor = colors[Math.floor(Math.random() * colors.length)];

    graphData.nodes.push({
      id: newId,
      parentId: parentNode.id,
      text: 'تفرع جديد',
      x: parentNode.x + 200,
      y: parentNode.y + Math.floor(Math.random() * 80) - 40,
      color: chosenColor,
    });

    selectedNodeId = newId;
    queueSave();
    renderNodesAndLines();
  });

  container.querySelector('#btn-auto-layout').addEventListener('click', autoLayout);

  container.querySelector('#btn-zoom-in').addEventListener('click', () => {
    zoom = Math.min(2, zoom + 0.15);
    canvas.style.transform = `scale(${zoom})`;
  });

  container.querySelector('#btn-zoom-out').addEventListener('click', () => {
    zoom = Math.max(0.5, zoom - 0.15);
    canvas.style.transform = `scale(${zoom})`;
  });

  renderNodesAndLines();
}
