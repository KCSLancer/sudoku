/* ═══════════════════════════════════════════════════
   SUDOKU ENGINE
═══════════════════════════════════════════════════ */
const BLANK = 0;

function getRelatedCells(r, c) {
    const set = new Set();
    const br = Math.floor(r/3)*3, bc = Math.floor(c/3)*3;
    for (let i = 0; i < 9; i++) {
        set.add(r*9+i); set.add(i*9+c);
        set.add((br+Math.floor(i/3))*9+(bc+i%3));
    }
    set.delete(r*9+c);
    return Array.from(set).map(idx => ({r: Math.floor(idx/9), c: idx%9}));
}

function generateFullGrid() {
    const g = Array.from({length:9}, ()=>Array(9).fill(BLANK));
    function valid(g,r,c,n) {
        const br=Math.floor(r/3)*3, bc=Math.floor(c/3)*3;
        for(let i=0;i<9;i++) {
            if(g[r][i]===n||g[i][c]===n||g[br+Math.floor(i/3)][bc+i%3]===n) return false;
        }
        return true;
    }
    function fill(g) {
        for(let r=0;r<9;r++) for(let c=0;c<9;c++) {
            if(g[r][c]===BLANK) {
                const nums=[1,2,3,4,5,6,7,8,9].sort(()=>Math.random()-0.5);
                for(const n of nums) {
                    if(valid(g,r,c,n)) {
                        g[r][c]=n;
                        if(fill(g)) return true;
                        g[r][c]=BLANK;
                    }
                }
                return false;
            }
        }
        return true;
    }
    fill(g);
    return g;
}

/* ── Human Logic Solver ── */
class HumanSolver {
    constructor(grid) {
        this.grid = grid.map(r=>[...r]);
        this.cands = Array.from({length:9},()=>Array.from({length:9},()=>new Set()));
        this.steps = [];       // {r,c,val,msg}  – placed cells
        this.maxLevel = 0;
        this._initCands();
    }

    _initCands() {
        for(let r=0;r<9;r++) for(let c=0;c<9;c++) {
            if(this.grid[r][c]===BLANK) {
                const s=new Set([1,2,3,4,5,6,7,8,9]);
                for(const rel of getRelatedCells(r,c))
                    if(this.grid[rel.r][rel.c]!==BLANK) s.delete(this.grid[rel.r][rel.c]);
                this.cands[r][c]=s;
            }
        }
    }

    _place(r,c,v,msg,level) {
        this.grid[r][c]=v;
        this.cands[r][c]=new Set();
        for(const rel of getRelatedCells(r,c)) this.cands[rel.r][rel.c].delete(v);
        this.steps.push({r,c,val:v,msg});
        this.maxLevel=Math.max(this.maxLevel,level);
    }

    /* L1 – Naked Single */
    nakedSingle() {
        for(let r=0;r<9;r++) for(let c=0;c<9;c++) {
            if(this.grid[r][c]===BLANK && this.cands[r][c].size===1) {
                const v=[...this.cands[r][c]][0];
                this._place(r,c,v,`Naked Single: 행${r+1} 열${c+1} → ${v}`,1);
                return true;
            }
        }
        return false;
    }

    /* L1 – Hidden Single */
    hiddenSingle() {
        for(let n=1;n<=9;n++) {
            // rows
            for(let r=0;r<9;r++) {
                const cells=[];
                for(let c=0;c<9;c++) if(this.grid[r][c]===BLANK && this.cands[r][c].has(n)) cells.push({r,c});
                if(cells.length===1) { this._place(cells[0].r,cells[0].c,n,`Hidden Single (행): 행${r+1} → ${n}`,1); return true; }
            }
            // cols
            for(let c=0;c<9;c++) {
                const cells=[];
                for(let r=0;r<9;r++) if(this.grid[r][c]===BLANK && this.cands[r][c].has(n)) cells.push({r,c});
                if(cells.length===1) { this._place(cells[0].r,cells[0].c,n,`Hidden Single (열): 열${c+1} → ${n}`,1); return true; }
            }
            // boxes
            for(let b=0;b<9;b++) {
                const br=Math.floor(b/3)*3, bc=(b%3)*3;
                const cells=[];
                for(let i=0;i<9;i++) {
                    const r=br+Math.floor(i/3), c=bc+i%3;
                    if(this.grid[r][c]===BLANK && this.cands[r][c].has(n)) cells.push({r,c});
                }
                if(cells.length===1) { this._place(cells[0].r,cells[0].c,n,`Hidden Single (박스): → ${n}`,1); return true; }
            }
        }
        return false;
    }

    /* L2 – Naked Pair (row/col/box) */
    nakedPair() {
        const groups = this._allGroups();
        for(const grp of groups) {
            const blanks=grp.filter(({r,c})=>this.grid[r][c]===BLANK);
            for(let i=0;i<blanks.length-1;i++) {
                const a=blanks[i];
                if(this.cands[a.r][a.c].size!==2) continue;
                for(let j=i+1;j<blanks.length;j++) {
                    const b=blanks[j];
                    if(this.cands[b.r][b.c].size===2 && this._setEq(this.cands[a.r][a.c],this.cands[b.r][b.c])) {
                        const pair=[...this.cands[a.r][a.c]];
                        let removed=false;
                        for(const cell of blanks) {
                            if((cell.r===a.r&&cell.c===a.c)||(cell.r===b.r&&cell.c===b.c)) continue;
                            for(const v of pair) {
                                if(this.cands[cell.r][cell.c].delete(v)) removed=true;
                            }
                        }
                        if(removed) { this.maxLevel=Math.max(this.maxLevel,2); return true; }
                    }
                }
            }
        }
        return false;
    }

    /* L2 – Hidden Pair */
    hiddenPair() {
        const groups = this._allGroups();
        for(const grp of groups) {
            const blanks=grp.filter(({r,c})=>this.grid[r][c]===BLANK);
            for(let n1=1;n1<=8;n1++) for(let n2=n1+1;n2<=9;n2++) {
                const cells=blanks.filter(({r,c})=>this.cands[r][c].has(n1)&&this.cands[r][c].has(n2));
                if(cells.length===2) {
                    // n1 & n2 appear only in these 2 cells in this group
                    const onlyHere = blanks.every(({r,c})=>{
                        const has1=this.cands[r][c].has(n1), has2=this.cands[r][c].has(n2);
                        const isCell=(cells[0].r===r&&cells[0].c===c)||(cells[1].r===r&&cells[1].c===c);
                        return isCell||((!has1)&&(!has2));
                    });
                    if(onlyHere) {
                        let removed=false;
                        for(const {r,c} of cells) {
                            for(const v of [...this.cands[r][c]]) {
                                if(v!==n1&&v!==n2) { this.cands[r][c].delete(v); removed=true; }
                            }
                        }
                        if(removed) { this.maxLevel=Math.max(this.maxLevel,2); return true; }
                    }
                }
            }
        }
        return false;
    }

    /* L3 – Pointing Pairs (box → line) */
    pointingPairs() {
        for(let b=0;b<9;b++) {
            const br=Math.floor(b/3)*3, bc=(b%3)*3;
            for(let n=1;n<=9;n++) {
                const cells=[];
                for(let i=0;i<9;i++) {
                    const r=br+Math.floor(i/3), c=bc+i%3;
                    if(this.grid[r][c]===BLANK && this.cands[r][c].has(n)) cells.push({r,c});
                }
                if(cells.length<2||cells.length>3) continue;
                const rows=new Set(cells.map(x=>x.r));
                const cols=new Set(cells.map(x=>x.c));
                let removed=false;
                if(rows.size===1) {
                    const row=[...rows][0];
                    for(let c=0;c<9;c++) {
                        if(c<bc||c>=bc+3) {
                            if(this.grid[row][c]===BLANK && this.cands[row][c].delete(n)) removed=true;
                        }
                    }
                }
                if(cols.size===1) {
                    const col=[...cols][0];
                    for(let r=0;r<9;r++) {
                        if(r<br||r>=br+3) {
                            if(this.grid[r][col]===BLANK && this.cands[r][col].delete(n)) removed=true;
                        }
                    }
                }
                if(removed) { this.maxLevel=Math.max(this.maxLevel,3); return true; }
            }
        }
        return false;
    }

    /* L3 – Box/Line Reduction (line → box) */
    boxLineReduction() {
        for(let n=1;n<=9;n++) {
            // rows
            for(let r=0;r<9;r++) {
                const cs=[]; for(let c=0;c<9;c++) if(this.grid[r][c]===BLANK&&this.cands[r][c].has(n)) cs.push(c);
                if(cs.length>=2&&cs.length<=3) {
                    const boxes=new Set(cs.map(c=>Math.floor(c/3)));
                    if(boxes.size===1) {
                        const bc=[...boxes][0]*3, br=Math.floor(r/3)*3;
                        let removed=false;
                        for(let i=0;i<3;i++) for(let j=0;j<3;j++) {
                            const rr=br+i, cc=bc+j;
                            if(rr!==r && this.grid[rr][cc]===BLANK && this.cands[rr][cc].delete(n)) removed=true;
                        }
                        if(removed) { this.maxLevel=Math.max(this.maxLevel,3); return true; }
                    }
                }
            }
            // cols
            for(let c=0;c<9;c++) {
                const rs=[]; for(let r=0;r<9;r++) if(this.grid[r][c]===BLANK&&this.cands[r][c].has(n)) rs.push(r);
                if(rs.length>=2&&rs.length<=3) {
                    const boxes=new Set(rs.map(r=>Math.floor(r/3)));
                    if(boxes.size===1) {
                        const br=[...boxes][0]*3, bc=Math.floor(c/3)*3;
                        let removed=false;
                        for(let i=0;i<3;i++) for(let j=0;j<3;j++) {
                            const rr=br+i, cc=bc+j;
                            if(cc!==c && this.grid[rr][cc]===BLANK && this.cands[rr][cc].delete(n)) removed=true;
                        }
                        if(removed) { this.maxLevel=Math.max(this.maxLevel,3); return true; }
                    }
                }
            }
        }
        return false;
    }

    /* L3 – Naked Triple */
    nakedTriple() {
        const groups=this._allGroups();
        for(const grp of groups) {
            const blanks=grp.filter(({r,c})=>this.grid[r][c]===BLANK&&this.cands[r][c].size>=2&&this.cands[r][c].size<=3);
            for(let i=0;i<blanks.length-2;i++) for(let j=i+1;j<blanks.length-1;j++) for(let k=j+1;k<blanks.length;k++) {
                const triple=[blanks[i],blanks[j],blanks[k]];
                const union=new Set([...this.cands[triple[0].r][triple[0].c],...this.cands[triple[1].r][triple[1].c],...this.cands[triple[2].r][triple[2].c]]);
                if(union.size===3) {
                    let removed=false;
                    for(const cell of grp.filter(({r,c})=>this.grid[r][c]===BLANK)) {
                        if(triple.some(t=>t.r===cell.r&&t.c===cell.c)) continue;
                        for(const v of union) { if(this.cands[cell.r][cell.c].delete(v)) removed=true; }
                    }
                    if(removed) { this.maxLevel=Math.max(this.maxLevel,3); return true; }
                }
            }
        }
        return false;
    }

    /* L4 – X-Wing */
    xWing() {
        for(let n=1;n<=9;n++) {
            // row-based X-Wing
            const rowData=[];
            for(let r=0;r<9;r++) {
                const cs=[]; for(let c=0;c<9;c++) if(this.grid[r][c]===BLANK&&this.cands[r][c].has(n)) cs.push(c);
                if(cs.length===2) rowData.push({r,cs});
            }
            for(let i=0;i<rowData.length-1;i++) for(let j=i+1;j<rowData.length;j++) {
                if(rowData[i].cs[0]===rowData[j].cs[0]&&rowData[i].cs[1]===rowData[j].cs[1]) {
                    const [c1,c2]=[rowData[i].cs[0],rowData[i].cs[1]];
                    let removed=false;
                    for(let r=0;r<9;r++) {
                        if(r===rowData[i].r||r===rowData[j].r) continue;
                        if(this.grid[r][c1]===BLANK&&this.cands[r][c1].delete(n)) removed=true;
                        if(this.grid[r][c2]===BLANK&&this.cands[r][c2].delete(n)) removed=true;
                    }
                    if(removed) { this.maxLevel=Math.max(this.maxLevel,4); return true; }
                }
            }
            // col-based
            const colData=[];
            for(let c=0;c<9;c++) {
                const rs=[]; for(let r=0;r<9;r++) if(this.grid[r][c]===BLANK&&this.cands[r][c].has(n)) rs.push(r);
                if(rs.length===2) colData.push({c,rs});
            }
            for(let i=0;i<colData.length-1;i++) for(let j=i+1;j<colData.length;j++) {
                if(colData[i].rs[0]===colData[j].rs[0]&&colData[i].rs[1]===colData[j].rs[1]) {
                    const [r1,r2]=[colData[i].rs[0],colData[i].rs[1]];
                    let removed=false;
                    for(let c=0;c<9;c++) {
                        if(c===colData[i].c||c===colData[j].c) continue;
                        if(this.grid[r1][c]===BLANK&&this.cands[r1][c].delete(n)) removed=true;
                        if(this.grid[r2][c]===BLANK&&this.cands[r2][c].delete(n)) removed=true;
                    }
                    if(removed) { this.maxLevel=Math.max(this.maxLevel,4); return true; }
                }
            }
        }
        return false;
    }

    /* L4 – XY-Wing */
    xyWing() {
        const bivs=[];
        for(let r=0;r<9;r++) for(let c=0;c<9;c++)
            if(this.grid[r][c]===BLANK&&this.cands[r][c].size===2) bivs.push({r,c});
        for(const pivot of bivs) {
            const [x,y]=[...this.cands[pivot.r][pivot.c]];
            // find pincers sharing one value with pivot
            const sees=piv=>getRelatedCells(piv.r,piv.c).filter(({r,c})=>this.grid[r][c]===BLANK&&this.cands[r][c].size===2);
            const pincerA=sees(pivot).filter(({r,c})=>{
                const s=this.cands[r][c]; return (s.has(x)&&!s.has(y))||(s.has(y)&&!s.has(x));
            });
            for(const pa of pincerA) {
                const zFromA=[...this.cands[pa.r][pa.c]].find(v=>v!==x&&v!==y);
                if(!zFromA) continue;
                const pincerB=sees(pivot).filter(({r,c})=>{
                    if(r===pa.r&&c===pa.c) return false;
                    const s=this.cands[r][c];
                    return s.size===2&&s.has(zFromA)&&(s.has(x)||s.has(y))&&!s.has(x===([...this.cands[pa.r][pa.c]].find(v=>v!==zFromA))?x:y);
                });
                for(const pb of pincerB) {
                    const common=getRelatedCells(pa.r,pa.c).filter(({r,c})=>getRelatedCells(pb.r,pb.c).some(x=>x.r===r&&x.c===c));
                    let removed=false;
                    for(const {r,c} of common) {
                        if((r===pivot.r&&c===pivot.c)||(r===pa.r&&c===pa.c)||(r===pb.r&&c===pb.c)) continue;
                        if(this.grid[r][c]===BLANK&&this.cands[r][c].delete(zFromA)) removed=true;
                    }
                    if(removed) { this.maxLevel=Math.max(this.maxLevel,4); return true; }
                }
            }
        }
        return false;
    }

    _allGroups() {
        const groups=[];
        for(let i=0;i<9;i++) {
            const row=[],col=[];
            for(let j=0;j<9;j++) { row.push({r:i,c:j}); col.push({r:j,c:i}); }
            groups.push(row,col);
        }
        for(let b=0;b<9;b++) {
            const br=Math.floor(b/3)*3, bc=(b%3)*3;
            const box=[];
            for(let i=0;i<3;i++) for(let j=0;j<3;j++) box.push({r:br+i,c:bc+j});
            groups.push(box);
        }
        return groups;
    }

    _setEq(a,b) { if(a.size!==b.size) return false; for(const v of a) if(!b.has(v)) return false; return true; }

    solve() {
        let progress=true;
        while(progress) {
            progress=false;
            if(this.nakedSingle()||this.hiddenSingle())                      { progress=true; continue; }
            if(this.nakedPair()||this.hiddenPair())                          { progress=true; continue; }
            if(this.pointingPairs()||this.boxLineReduction()||this.nakedTriple()) { progress=true; continue; }
            if(this.xWing()||this.xyWing())                                  { progress=true; continue; }
        }
        let solved=true;
        for(let r=0;r<9;r++) for(let c=0;c<9;c++) if(this.grid[r][c]===BLANK) solved=false;
        return {solved, maxLevel:this.maxLevel, steps:this.steps};
    }
}

/* ── Puzzle Generator ── */
function generatePuzzle(level) {
    const full=generateFullGrid();
    const puzzle=full.map(r=>[...r]);
    const maxLevel={'Easy':1,'Medium':2,'Hard':3,'Expert':4}[level];
    const target={'Easy':36,'Medium':46,'Hard':52,'Expert':58}[level];

    const positions=[];
    for(let r=0;r<9;r++) for(let c=0;c<9;c++) positions.push({r,c});
    positions.sort(()=>Math.random()-0.5);

    let emptied=0;
    for(const pos of positions) {
        if(emptied>=target) break;
        const backup=puzzle[pos.r][pos.c];
        puzzle[pos.r][pos.c]=BLANK;

        const res=new HumanSolver(puzzle).solve();
        if(!res.solved||res.maxLevel>maxLevel) {
            puzzle[pos.r][pos.c]=backup; // revert
        } else {
            emptied++;
        }
    }
    return {puzzle, solution:full};
}

/* ═══════════════════════════════════════════════════
   GAME STATE
═══════════════════════════════════════════════════ */
const INIT_SCORE={'Easy':1000,'Medium':2000,'Hard':3500,'Expert':5000};

let G = {
    level:null, puzzle:null, solution:null,
    userGrid:null,
    memoGrid:null,   // 9×9 array of Set
    score:0, time:0, hintsUsed:0,
    timer:null, sel:null,
    memoMode:false,
    hintSteps:[]
};

/* ── Screens ── */
function showScreen(id) {
    document.querySelectorAll('.active-screen').forEach(s=>s.classList.remove('active-screen'));
    document.getElementById(id).classList.add('active-screen');
}

/* ── Start game ── */
function startGame(level) {
    document.getElementById('loading').classList.add('active');
    setTimeout(()=>{
        clearInterval(G.timer);
        const {puzzle,solution}=generatePuzzle(level);

        G = {
            level, puzzle, solution,
            userGrid: puzzle.map(r=>[...r]),
            memoGrid: Array.from({length:9},()=>Array.from({length:9},()=>new Set())),
            score: INIT_SCORE[level],
            time:0, hintsUsed:0,
            sel:null, memoMode:false,
            timer: setInterval(tick,1000),
            hintSteps: new HumanSolver(puzzle).solve().steps
        };
        setMemoUI(false);
        renderBoard();
        updateHeader();
        document.getElementById('loading').classList.remove('active');
        showScreen('game-screen');
    },80);
}

/* ── Timer ── */
function tick() {
    G.time++;
    if(G.time%10===0) G.score=Math.max(0,G.score-5);
    updateHeader();
}

function updateHeader() {
    document.getElementById('ui-level').textContent=G.level;
    document.getElementById('ui-score').textContent=G.score;
    document.getElementById('ui-hints').textContent=G.hintsUsed;
    const m=String(Math.floor(G.time/60)).padStart(2,'0');
    const s=String(G.time%60).padStart(2,'0');
    document.getElementById('ui-time').textContent=`${m}:${s}`;
}

/* ── Board Render ── */
function renderBoard() {
    const board=document.getElementById('board');
    board.innerHTML='';
    for(let r=0;r<9;r++) for(let c=0;c<9;c++) {
        const cell=document.createElement('div');
        cell.className='cell';
        cell.dataset.r=r; cell.dataset.c=c;

        const fix=G.puzzle[r][c], user=G.userGrid[r][c];
        const memos=G.memoGrid[r][c];

        if(fix!==BLANK) {
            cell.classList.add('fixed');
            cell.innerHTML=`<span class="cell-value">${fix}</span>`;
        } else if(user!==BLANK) {
            const correct=user===G.solution[r][c];
            cell.classList.add(correct?'input':'error');
            cell.innerHTML=`<span class="cell-value">${user}</span>`;
        } else if(memos.size>0) {
            // render memo grid
            let html='<div class="memo-grid">';
            for(let n=1;n<=9;n++) {
                const on=memos.has(n);
                const conflict=on&&isConflict(r,c,n);
                html+=`<span class="memo-num${on?' on':''}${conflict?' conflict':''}" data-n="${n}">${on?n:''}</span>`;
            }
            html+='</div>';
            cell.innerHTML=html;
        }

        cell.addEventListener('click',()=>selectCell(r,c));
        board.appendChild(cell);
    }
    applyHighlights();
    updateNumpadState();
}

function isConflict(r,c,n) {
    for(const rel of getRelatedCells(r,c)) {
        if(G.userGrid[rel.r][rel.c]===n||G.puzzle[rel.r][rel.c]===n) return true;
    }
    return false;
}

/* ── Selection & Highlight ── */
function selectCell(r,c) {
    G.sel={r,c};
    applyHighlights();
}

function applyHighlights() {
    if(!G.sel) return;
    const {r,c}=G.sel;
    const selVal=G.userGrid[r][c]||G.puzzle[r][c];
    document.querySelectorAll('.cell').forEach(el=>{
        el.classList.remove('selected','highlighted','same-number');
        const cr=+el.dataset.r, cc=+el.dataset.c;
        if(cr===r&&cc===c) { el.classList.add('selected'); return; }
        // same row/col/box
        const sameGroup=cr===r||cc===c||(Math.floor(cr/3)===Math.floor(r/3)&&Math.floor(cc/3)===Math.floor(c/3));
        if(sameGroup) el.classList.add('highlighted');
        // same number
        const cv=G.userGrid[cr][cc]||G.puzzle[cr][cc];
        if(selVal&&selVal!==BLANK&&cv===selVal) el.classList.add('same-number');
    });
}

/* ── Input ── */
function handleInput(n) {
    if(!G.sel) return;
    const {r,c}=G.sel;
    if(G.puzzle[r][c]!==BLANK) return; // fixed cell

    if(n===0) {
        // Delete: clear value AND memos
        G.userGrid[r][c]=BLANK;
        G.memoGrid[r][c]=new Set();
        refreshHints();
        renderBoard();
        selectCell(r,c);
        return;
    }

    if(G.memoMode) {
        // Toggle memo
        if(G.userGrid[r][c]!==BLANK) return; // has value, can't memo
        const memo=G.memoGrid[r][c];
        if(memo.has(n)) memo.delete(n); else memo.add(n);
        renderBoard();
        selectCell(r,c);
    } else {
        // Place value
        G.userGrid[r][c]=n;
        G.memoGrid[r][c]=new Set(); // clear cell's own memos
        // Auto-remove n from related cells' memos
        for(const rel of getRelatedCells(r,c)) G.memoGrid[rel.r][rel.c].delete(n);
        refreshHints();
        renderBoard();
        selectCell(r,c);
        checkWin();
    }
}

function refreshHints() {
    G.hintSteps=new HumanSolver(G.userGrid).solve().steps;
}

/* ── Numpad disable for completed numbers ── */
function updateNumpadState() {
    const inMemo = G.memoMode;
    // Count how many times each number appears on the full board (puzzle + user)
    const count = new Array(10).fill(0);
    for(let r=0;r<9;r++) for(let c=0;c<9;c++) {
        const v = G.puzzle[r][c] !== BLANK ? G.puzzle[r][c] : G.userGrid[r][c];
        if(v !== BLANK) count[v]++;
    }
    document.querySelectorAll('.num-btn:not(.del-inline)').forEach(btn => {
        const n = parseInt(btn.textContent);
        if(isNaN(n)) return;
        btn.disabled = !inMemo && count[n] >= 9;
    });
}

/* ── Memo Toggle ── */
function toggleMemoMode() {
    G.memoMode=!G.memoMode;
    setMemoUI(G.memoMode);
    updateNumpadState();
}
function setMemoUI(on) {
    const btn=document.getElementById('memo-toggle');
    document.getElementById('memo-label').textContent=on?'ON':'OFF';
    btn.classList.toggle('active',on);
    document.body.classList.toggle('memo-mode',on);
}

/* ── Hint ── */
function useHint() {
    if(G.hintSteps.length===0) {
        showHintText('더 이상 힌트를 찾을 수 없어요');
        return;
    }
    const step=G.hintSteps[0];
    G.hintsUsed++;
    G.score=Math.max(0,G.score-100);
    updateHeader();

    // Flash the cell
    selectCell(step.r,step.c);
    const el=document.querySelector(`.cell[data-r="${step.r}"][data-c="${step.c}"]`);
    if(el) {
        el.style.transition='background 0.1s';
        el.style.background='rgba(245,158,11,0.4)';
        setTimeout(()=>el.style.background='',600);
    }
    showHintText(`💡 ${step.msg}`);
}

function showHintText(msg) {
    const el=document.getElementById('hint-text');
    el.textContent=msg;
    el.style.opacity=1;
    clearTimeout(el._t);
    el._t=setTimeout(()=>el.style.opacity=0,3500);
}

/* ── Win ── */
function checkWin() {
    for(let r=0;r<9;r++) for(let c=0;c<9;c++)
        if(G.userGrid[r][c]!==G.solution[r][c]) return;
    clearInterval(G.timer);
    saveRecord(G.level,G.score);
    createParticles();
    const m=String(Math.floor(G.time/60)).padStart(2,'0');
    const s=String(G.time%60).padStart(2,'0');
    document.getElementById('win-level').textContent=G.level;
    document.getElementById('win-time').textContent=`${m}:${s}`;
    document.getElementById('win-score').textContent=`${G.score} pts`;
    document.getElementById('win-modal').classList.add('active');
}

function createParticles() {
    const colors=['#00d4ff','#7c3aed','#f59e0b','#34d399'];
    for(let i=0;i<70;i++) {
        const p=document.createElement('div');
        p.className='particle';
        p.style.cssText=`left:50%;top:50%;background:${colors[i%colors.length]};box-shadow:0 0 8px ${colors[i%colors.length]}`;
        const angle=Math.random()*Math.PI*2, dist=80+Math.random()*260;
        p.animate([
            {transform:'translate(-50%,-50%) scale(1)',opacity:1},
            {transform:`translate(calc(-50% + ${Math.cos(angle)*dist}px),calc(-50% + ${Math.sin(angle)*dist}px)) scale(0)`,opacity:0}
        ],{duration:800+Math.random()*800,easing:'cubic-bezier(0,.9,.57,1)',fill:'forwards'});
        document.body.appendChild(p);
        setTimeout(()=>p.remove(),1700);
    }
}

function closeWinModal() {
    document.getElementById('win-modal').classList.remove('active');
    backToMenu();
}
function backToMenu() {
    clearInterval(G.timer);
    showScreen('menu-screen');
}

/* ── Records ── */
function saveRecord(level,score) {
    const rec=JSON.parse(localStorage.getItem('neonSudoku')||'{}');
    if(!rec[level]) rec[level]=[];
    rec[level].push({score,date:new Date().toLocaleDateString('ko-KR')});
    rec[level].sort((a,b)=>b.score-a.score);
    rec[level]=rec[level].slice(0,5);
    localStorage.setItem('neonSudoku',JSON.stringify(rec));
}

function showRecords() {
    const rec=JSON.parse(localStorage.getItem('neonSudoku')||'{}');
    let html='';
    for(const lv of ['Easy','Medium','Hard','Expert']) {
        html+=`<div class="record-level-section"><div class="record-level-title">${lv}</div>`;
        if(rec[lv]&&rec[lv].length) {
            rec[lv].forEach((e,i)=>{
                html+=`<div class="record-row"><span class="record-rank">${i+1}.</span><span style="color:var(--text-muted);font-size:0.8rem">${e.date}</span><span class="record-score">${e.score} pts</span></div>`;
            });
        } else {
            html+=`<div class="record-empty">기록 없음</div>`;
        }
        html+='</div>';
    }
    document.getElementById('records-container').innerHTML=html;
    showScreen('records-screen');
}

/* ── Keyboard ── */
document.addEventListener('keydown',e=>{
    const onGame=document.getElementById('game-screen').classList.contains('active-screen');
    if(!onGame) return;
    if(e.key>='1'&&e.key<='9') { handleInput(parseInt(e.key)); return; }
    if(e.key==='Backspace'||e.key==='Delete'||e.key==='0') { handleInput(0); return; }
    if(e.key==='m'||e.key==='M') { toggleMemoMode(); return; }
    if(!G.sel) return;
    const {r,c}=G.sel;
    const moves={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1]};
    if(moves[e.key]) {
        const [dr,dc]=moves[e.key];
        selectCell((r+dr+9)%9,(c+dc+9)%9);
        e.preventDefault();
    }
});
