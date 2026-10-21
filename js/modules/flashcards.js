/**
 * flashcards.js - البطاقات التعليمية والمراجعة النشطة
 * Spaced repetition flashcards with 3D flip animation and study mode.
 * @module modules/flashcards
 */

import { add, get, getAll, update, remove, getAllFromIndex } from '../db/database.js';
import { icon } from '../utils/icons.js';
import { toast, confirm, modal, emptyState, loadingSpinner, progressBar } from '../utils/ui.js';
import { sanitizeHTML } from '../utils/validation.js';
import { navigate } from '../router.js';

export async function render(container, params) {
  const deckId = params?.deckId;
  if (deckId) {
    await renderDeckPractice(container, deckId);
  } else {
    await renderDecksList(container);
  }
}

async function renderDecksList(container) {
  container.innerHTML = loadingSpinner('جاري تحميل مجموعات البطاقات...');

  async function loadData() {
    const [decks, cards, subjects] = await Promise.all([
      getAll('flashcardDecks'),
      getAll('flashcards'),
      getAll('subjects'),
    ]);
    return { decks: decks || [], cards: cards || [], subjects: subjects || [] };
  }

  function renderView(data) {
    const { decks, cards, subjects } = data;
    const subjectsMap = new Map(subjects.map((s) => [s.id, s]));

    container.innerHTML = `
      <div class="flashcards-container">
        <!-- Header -->
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div>
            <h2 style="font-size: 20px; font-weight: 700; color: var(--color-text); margin: 0;">البطاقات التعليمية</h2>
            <span style="font-size: 13px; color: var(--color-text-secondary);">المراجعة النشطة للقوانين والمعادلات والمصطلحات</span>
          </div>
          <button id="btn-add-deck" class="btn btn-primary" style="display: inline-flex; align-items: center; gap: 6px;">
            ${icon('plus', 18)}
            <span>مجموعة جديدة</span>
          </button>
        </div>

        <!-- Decks Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; margin-top: 6px;">
          ${
            decks.length === 0
              ? emptyState(
                  'cards',
                  'لا توجد مجموعات بطاقات',
                  'أنشئ مجموعة بطاقات لمادة معينة وضع فيها أسئلة وقوانين لمراجعتها بسرعة.',
                  'إنشاء مجموعة بطاقات',
                  () => openDeckForm(null, data)
                )
              : decks
                  .map((d) => {
                    const deckCards = cards.filter((c) => c.deckId === d.id);
                    const knownCount = deckCards.filter((c) => c.status === 'known').length;
                    const subj = subjectsMap.get(d.subjectId);
                    const subjName = subj ? subj.name : 'عام';
                    const subjColor = subj ? subj.color : '#24A58A';

                    return `
                    <div class="card deck-card" data-id="${d.id}" style="cursor: pointer; border-right: 4px solid ${subjColor}; display: flex; flex-direction: column; gap: 10px;">
                      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div>
                          <div style="font-size: 16px; font-weight: 700; color: var(--color-text);">${sanitizeHTML(d.title)}</div>
                          <span class="badge" style="background: ${subjColor}15; color: ${subjColor}; font-weight: 600; font-size: 11px; margin-top: 4px;">${sanitizeHTML(subjName)}</span>
                        </div>
                        <button class="btn btn-ghost btn-delete-deck" data-id="${d.id}" style="padding: 4px; color: var(--color-danger);" title="حذف">
                          ${icon('trash', 16)}
                        </button>
                      </div>

                      <div style="font-size: 12px; color: var(--color-text-secondary);">
                        إجمالي البطاقات: <b>${deckCards.length}</b> • المتقنة: <b>${knownCount}</b>
                      </div>

                      ${progressBar(knownCount, Math.max(1, deckCards.length), 'var(--color-secondary, #24A58A)')}
                    </div>
                  `;
                  })
                  .join('')
          }
        </div>
      </div>
    `;

    container.querySelector('#btn-add-deck').addEventListener('click', () => {
      openDeckForm(null, data);
    });

    container.querySelectorAll('.deck-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.btn-delete-deck')) return;
        navigate(`/flashcards/${card.dataset.id}`);
      });
    });

    container.querySelectorAll('.btn-delete-deck').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const ok = await confirm('حذف المجموعة', 'هل أنت متأكد من حذف هذه المجموعة وجميع بطاقاتها؟', 'حذف', 'إلغاء', true);
        if (ok) {
          const dId = btn.dataset.id;
          await remove('flashcardDecks', dId);
          // Delete cards inside deck
          const deckCards = cards.filter((c) => c.deckId === dId);
          for (const c of deckCards) {
            await remove('flashcards', c.id);
          }
          toast('تم حذف مجموعة البطاقات', 'success');
          const updated = await loadData();
          renderView(updated);
        }
      });
    });
  }

  function openDeckForm(deck, data) {
    const { subjects } = data;
    const formHTML = `
      <form id="deck-form" style="display: flex; flex-direction: column; gap: 14px; direction: rtl;">
        <div>
          <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">عنوان المجموعة *</label>
          <input type="text" name="title" placeholder="مثال: قوانين الكهرومغناطيسية الفصل 1" required style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-bg); font-size: 14px;" />
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

    modal('إنشاء مجموعة بطاقات جديدة', formHTML, [
      {
        text: 'إنشاء المجموعة',
        className: 'btn btn-primary',
        onClick: async (closeFn) => {
          const form = document.getElementById('deck-form');
          const title = form.title.value.trim();
          if (!title) {
            toast('يرجى إدخال عنوان للمجموعة', 'warning');
            return;
          }

          const newId = await add('flashcardDecks', {
            title,
            subjectId: form.subjectId.value || '',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });

          toast('تم إنشاء المجموعة بنجاح', 'success');
          closeFn();
          navigate(`/flashcards/${newId}`);
        },
      },
    ]);
  }

  const initialData = await loadData();
  renderView(initialData);
}

async function renderDeckPractice(container, deckId) {
  container.innerHTML = loadingSpinner('جاري تحميل البطاقات...');

  const deck = await get('flashcardDecks', deckId);
  if (!deck) {
    toast('المجموعة غير موجودة', 'error');
    navigate('/flashcards');
    return;
  }

  async function loadCards() {
    return (await getAllFromIndex('flashcards', 'deckId', deckId)) || [];
  }

  let cards = await loadCards();
  let currentIndex = 0;
  let isFlipped = false;
  let reviewOnly = false;

  function getWorkingCards() {
    if (reviewOnly) {
      return cards.filter((c) => c.status !== 'known');
    }
    return cards;
  }

  function renderView() {
    const working = getWorkingCards();
    const currentCard = working[currentIndex];

    container.innerHTML = `
      <div class="flashcards-container" style="max-width: 600px; margin: 0 auto;">
        <!-- Top Toolbar -->
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <button id="btn-back-decks" class="btn btn-ghost" style="padding: 6px 12px; display: inline-flex; align-items: center; gap: 4px;">
            ${icon('chevron-right', 20)}
            <span>المجموعات</span>
          </button>
          <div style="text-align: center;">
            <h3 style="font-size: 16px; font-weight: 700; margin: 0; color: var(--color-text);">${sanitizeHTML(deck.title)}</h3>
            <span style="font-size: 12px; color: var(--color-text-secondary);">${working.length > 0 ? `بطاقة ${currentIndex + 1} من ${working.length}` : 'لا توجد بطاقات'}</span>
          </div>
          <button id="btn-add-card" class="btn btn-primary btn-sm" style="display: inline-flex; align-items: center; gap: 4px;">
            ${icon('plus', 16)}
            <span>بطاقة</span>
          </button>
        </div>

        ${
          working.length === 0
            ? emptyState(
                'cards',
                reviewOnly ? 'أحسنت! لا توجد بطاقات تحتاج للمراجعة' : 'المجموعة فارغة',
                reviewOnly ? 'لقد أتقنت جميع البطاقات في هذه المجموعة.' : 'أضف أول بطاقة تعليمية تتضمن سؤالاً أو قانوناً على الوجه وإجابته على الظهر.',
                reviewOnly ? 'عرض كل البطاقات' : 'إضافة بطاقة الآن',
                () => {
                  if (reviewOnly) {
                    reviewOnly = false;
                    renderView();
                  } else {
                    openCardForm(null);
                  }
                }
              )
            : `
          <!-- 3D Flip Card -->
          <div class="flashcard-stage" id="flip-card-stage">
            <div class="flashcard-inner ${isFlipped ? 'flipped' : ''}" id="flip-card-inner">
              <!-- Front Side (Question) -->
              <div class="flashcard-front">
                <span style="font-size: 12px; color: var(--color-text-secondary); margin-bottom: 12px;">السؤال / القانون (انقر للكشف)</span>
                <div class="flashcard-text">${sanitizeHTML(currentCard.question)}</div>
                <div style="margin-top: 16px; font-size: 11px; color: var(--color-primary); font-weight: 600;">🔄 اضغط لقلب البطاقة</div>
              </div>

              <!-- Back Side (Answer) -->
              <div class="flashcard-back">
                <span style="font-size: 12px; color: var(--color-text-secondary); margin-bottom: 12px;">الإجابة / الشرح</span>
                <div class="flashcard-text" style="color: var(--color-secondary, #24A58A);">${sanitizeHTML(currentCard.answer)}</div>
                <div style="margin-top: 16px; font-size: 11px; color: var(--color-text-secondary);">🔄 اضغط للعودة للسؤال</div>
              </div>
            </div>
          </div>

          <!-- Answer Evaluation Buttons (after flipping) -->
          <div style="display: flex; gap: 10px; margin-top: 12px;">
            <button id="btn-mark-review" class="btn btn-secondary" style="flex: 1; border-color: #D9534F; color: #D9534F; display: inline-flex; align-items: center; justify-content: center; gap: 6px;">
              ${icon('refresh', 16)}
              <span>أحتاج مراجعتها</span>
            </button>
            <button id="btn-mark-known" class="btn btn-primary" style="flex: 1; background: var(--color-secondary, #24A58A); border-color: var(--color-secondary, #24A58A); display: inline-flex; align-items: center; justify-content: center; gap: 6px;">
              ${icon('check', 16)}
              <span>أعرفها تماماً ✓</span>
            </button>
          </div>

          <!-- Navigation Controls -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
            <button id="btn-prev-card" class="btn btn-secondary" style="padding: 8px 16px;" ${currentIndex === 0 ? 'disabled' : ''}>
              ${icon('chevron-right', 18)} السابقة
            </button>
            <div style="display: flex; gap: 8px;">
              <button id="btn-edit-card" class="btn btn-ghost" style="padding: 6px;" title="تعديل">${icon('edit', 18)}</button>
              <button id="btn-delete-card" class="btn btn-ghost" style="padding: 6px; color: var(--color-danger);" title="حذف">${icon('trash', 18)}</button>
            </div>
            <button id="btn-next-card" class="btn btn-secondary" style="padding: 8px 16px;" ${currentIndex >= working.length - 1 ? 'disabled' : ''}>
              التالية ${icon('chevron-left', 18)}
            </button>
          </div>
        `
        }

        <!-- Study Mode Toggles -->
        <div style="margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: center; font-size: 13px;">
          <label style="display: inline-flex; align-items: center; gap: 6px; cursor: pointer;">
            <input type="checkbox" id="chk-review-only" ${reviewOnly ? 'checked' : ''} />
            <span>عرض البطاقات غير المتقنة فقط</span>
          </label>
          <button id="btn-shuffle" class="btn btn-ghost btn-sm" style="display: inline-flex; align-items: center; gap: 4px;">
            ${icon('sort', 16)}
            <span>خلط عشوائي</span>
          </button>
        </div>
      </div>
    `;

    // Event listeners
    container.querySelector('#btn-back-decks').addEventListener('click', () => {
      navigate('/flashcards');
    });

    const addBtn = container.querySelector('#btn-add-card');
    if (addBtn) addBtn.addEventListener('click', () => openCardForm(null));

    const stage = container.querySelector('#flip-card-stage');
    if (stage) {
      stage.addEventListener('click', () => {
        isFlipped = !isFlipped;
        container.querySelector('#flip-card-inner').classList.toggle('flipped', isFlipped);
      });
    }

    const prevBtn = container.querySelector('#btn-prev-card');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (currentIndex > 0) {
          currentIndex--;
          isFlipped = false;
          renderView();
        }
      });
    }

    const nextBtn = container.querySelector('#btn-next-card');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (currentIndex < working.length - 1) {
          currentIndex++;
          isFlipped = false;
          renderView();
        }
      });
    }

    const knownBtn = container.querySelector('#btn-mark-known');
    if (knownBtn) {
      knownBtn.addEventListener('click', async () => {
        currentCard.status = 'known';
        await update('flashcards', currentCard);
        toast('تم تحديد البطاقة كمتقنة! 🎉', 'success', 1500);
        if (currentIndex < working.length - 1) currentIndex++;
        isFlipped = false;
        renderView();
      });
    }

    const revBtn = container.querySelector('#btn-mark-review');
    if (revBtn) {
      revBtn.addEventListener('click', async () => {
        currentCard.status = 'unknown';
        await update('flashcards', currentCard);
        toast('تم وضع البطاقة للمراجعة', 'info', 1500);
        if (currentIndex < working.length - 1) currentIndex++;
        isFlipped = false;
        renderView();
      });
    }

    const editCardBtn = container.querySelector('#btn-edit-card');
    if (editCardBtn) {
      editCardBtn.addEventListener('click', () => openCardForm(currentCard));
    }

    const delCardBtn = container.querySelector('#btn-delete-card');
    if (delCardBtn) {
      delCardBtn.addEventListener('click', async () => {
        const ok = await confirm('حذف البطاقة', 'هل أنت متأكد من حذف هذه البطاقة؟', 'حذف', 'إلغاء', true);
        if (ok) {
          await remove('flashcards', currentCard.id);
          toast('تم حذف البطاقة', 'success');
          cards = await loadCards();
          if (currentIndex >= cards.length && currentIndex > 0) currentIndex--;
          isFlipped = false;
          renderView();
        }
      });
    }

    const chkRev = container.querySelector('#chk-review-only');
    if (chkRev) {
      chkRev.addEventListener('change', (e) => {
        reviewOnly = e.target.checked;
        currentIndex = 0;
        isFlipped = false;
        renderView();
      });
    }

    const shufBtn = container.querySelector('#btn-shuffle');
    if (shufBtn) {
      shufBtn.addEventListener('click', () => {
        cards.sort(() => Math.random() - 0.5);
        currentIndex = 0;
        isFlipped = false;
        toast('تم خلط البطاقات عشوائياً', 'info');
        renderView();
      });
    }
  }

  function openCardForm(cardToEdit) {
    const isEdit = !!cardToEdit;
    const cur = cardToEdit || { question: '', answer: '' };

    const formHTML = `
      <form id="card-form" style="display: flex; flex-direction: column; gap: 14px; direction: rtl;">
        <div>
          <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">وجه البطاقة (السؤال / القانون / المصطلح) *</label>
          <textarea name="question" rows="3" placeholder="اكتب السؤال أو المعادلة هنا..." required style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-bg); font-size: 14px; resize: vertical;">${sanitizeHTML(cur.question)}</textarea>
        </div>
        <div>
          <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px;">ظهر البطاقة (الإجابة / الشرح / التعويض) *</label>
          <textarea name="answer" rows="3" placeholder="اكتب الإجابة النموذجية أو التعريف هنا..." required style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--color-border); background: var(--color-bg); font-size: 14px; resize: vertical;">${sanitizeHTML(cur.answer)}</textarea>
        </div>
      </form>
    `;

    modal(isEdit ? 'تعديل البطاقة' : 'إضافة بطاقة تعليمية', formHTML, [
      {
        text: 'حفظ البطاقة',
        className: 'btn btn-primary',
        onClick: async (closeFn) => {
          const form = document.getElementById('card-form');
          const q = form.question.value.trim();
          const a = form.answer.value.trim();

          if (!q || !a) {
            toast('يرجى ملء الوجه والظهر للبطاقة', 'warning');
            return;
          }

          if (isEdit) {
            cardToEdit.question = q;
            cardToEdit.answer = a;
            await update('flashcards', cardToEdit);
            toast('تم تعديل البطاقة', 'success');
          } else {
            await add('flashcards', {
              deckId,
              question: q,
              answer: a,
              status: 'unknown',
              createdAt: Date.now(),
            });
            toast('تمت إضافة البطاقة بنجاح', 'success');
          }

          closeFn();
          cards = await loadCards();
          isFlipped = false;
          renderView();
        },
      },
    ]);
  }

  renderView();
}
