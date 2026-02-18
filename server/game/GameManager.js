const EventEmitter = require('events');

// Teen Patti Hand Rankings (Highest to Lowest)
const HAND_RANKINGS = {
    TRAIL: 6,        // Three of a kind
    PURE_SEQUENCE: 5, // Straight flush
    SEQUENCE: 4,     // Straight
    COLOR: 3,        // Flush
    PAIR: 2,         // Pair
    HIGH_CARD: 1     // High card
};

// Card utilities
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function createDeck() {
    const deck = [];
    for (const suit of SUITS) {
        for (const rank of RANKS) {
            deck.push({ suit, rank, value: RANKS.indexOf(rank) + 2 });
        }
    }
    return deck;
}

function shuffleDeck(deck) {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function evaluateHand(cards) {
    // Sort by value descending
    const sorted = [...cards].sort((a, b) => b.value - a.value);
    const [c1, c2, c3] = sorted;
    
    // Check for Trail (Three of a kind)
    if (c1.value === c2.value && c2.value === c3.value) {
        return { rank: HAND_RANKINGS.TRAIL, value: c1.value, cards: sorted };
    }
    
    // Check for Pure Sequence (Straight Flush)
    const isSequence = (c1.value - c2.value === 1 && c2.value - c3.value === 1) || 
                       (c1.rank === 'A' && c2.rank === '2' && c3.rank === '3'); // A-2-3 special case
    const isSameSuit = c1.suit === c2.suit && c2.suit === c3.suit;
    
    if (isSameSuit && isSequence) {
        return { rank: HAND_RANKINGS.PURE_SEQUENCE, value: c1.value, cards: sorted };
    }
    
    // Check for Sequence (Straight)
    if (isSequence) {
        return { rank: HAND_RANKINGS.SEQUENCE, value: c1.value, cards: sorted };
    }
    
    // Check for Color (Flush)
    if (isSameSuit) {
        return { rank: HAND_RANKINGS.COLOR, value: c1.value, cards: sorted };
    }
    
    // Check for Pair
    if (c1.value === c2.value) {
        return { rank: HAND_RANKINGS.PAIR, value: c1.value * 100 + c3.value, cards: sorted };
    }
    if (c2.value === c3.value) {
        return { rank: HAND_RANKINGS.PAIR, value: c2.value * 100 + c1.value, cards: sorted };
    }
    
    // High Card
    return { rank: HAND_RANKINGS.HIGH_CARD, value: c1.value * 10000 + c2.value * 100 + c3.value, cards: sorted };
}

function compareHands(hand1, hand2) {
    if (hand1.rank !== hand2.rank) {
        return hand1.rank - hand2.rank;
    }
    return hand1.value - hand2.value;
}

class GameManager extends EventEmitter {
    constructor(sessionId, sessionName, totalRounds) {
        super();
        this.sessionId = sessionId;
        this.sessionName = sessionName;
        this.totalRounds = totalRounds;
        this.currentRound = 1;
        this.isActive = true;

        this.gameState = {
            players: [], // { id, name, seat, sessionBalance, status, folded, invested, hand(server-only) }
            pot: 0,
            currentStake: 20,
            activePlayerIndex: 0,
            gamePlayers: [], // subset of players in current hand
            currentLogs: [],
            phase: 'SETUP', // SETUP, ACTIVE, SHOWDOWN
            sideShowRequest: null, // { requesterId, targetId }
            showRequest: null // { requester, target, isForceShow }
        };
        
        // F1 FIX: Track timeouts for show/side-show requests
        this.requestTimeouts = new Map();
        this.REQUEST_TIMEOUT_MS = 60000; // 60 seconds timeout
    }
    
    // F1 FIX: Clear all pending request timeouts
    clearRequestTimeouts() {
        for (const [key, timeoutId] of this.requestTimeouts) {
            clearTimeout(timeoutId);
        }
        this.requestTimeouts.clear();
    }
    
    // F1 FIX: Set timeout for a request
    setRequestTimeout(requestType, callback) {
        // Clear existing timeout for this request type
        if (this.requestTimeouts.has(requestType)) {
            clearTimeout(this.requestTimeouts.get(requestType));
        }
        
        const timeoutId = setTimeout(() => {
            this.requestTimeouts.delete(requestType);
            callback();
        }, this.REQUEST_TIMEOUT_MS);
        
        this.requestTimeouts.set(requestType, timeoutId);
    }

    // --- SETUP ---
    setPlayers(initialPlayers) {
        // initialPlayers: [{ id, name, seat, sessionBalance }]
        this.gameState.players = initialPlayers.map(p => ({
            ...p,
            status: 'BLIND',
            folded: false,
            invested: 0
        }));
        // Only reset phase to SETUP if game hasn't started yet
        // This preserves game state when operator reconnects
        if (!this.gameState.phase || this.gameState.phase === 'SETUP') {
            this.gameState.phase = 'SETUP';
        }
    }

    addPlayer(player) {
        if (this.gameState.phase !== 'SETUP') return false;
        this.gameState.players.push({
            ...player,
            status: 'BLIND',
            folded: false,
            invested: 0
        });
        return true;
    }

    removePlayer(playerId) {
        if (this.gameState.phase !== 'SETUP') return false;
        this.gameState.players = this.gameState.players.filter(p => p.id !== playerId);
        return true;
    }

    // --- GAME LOOP ---
    startRound() {
        console.log('[DEBUG] startRound called. Total players:', this.gameState.players.length);
        
        // Check if session is complete (round was already incremented in endHand)
        if (this.currentRound > this.totalRounds) {
            this.isActive = false;
            return { success: false, error: "Session complete" };
        }
        
        const validPlayers = this.gameState.players.filter(p => p.name && p.name.trim() !== '');
        console.log('[DEBUG] Valid players:', validPlayers.length, validPlayers);
        
        if (validPlayers.length < 2) return { success: false, error: "Not enough players" };

        // Create and shuffle deck
        const deck = shuffleDeck(createDeck());
        let deckIndex = 0;

        // Reset state for new round and deal cards
        this.gameState.gamePlayers = validPlayers.map(p => ({
            ...p,
            status: 'BLIND',
            folded: false,
            invested: 5, // Boot amount
            hand: [deck[deckIndex++], deck[deckIndex++], deck[deckIndex++]] // Deal 3 cards
        }));
        
        console.log('[DEBUG] gamePlayers set:', this.gameState.gamePlayers.length, this.gameState.gamePlayers);
        console.log('[DEBUG] Sample hand:', this.gameState.gamePlayers[0]?.hand);

        this.gameState.pot = this.gameState.gamePlayers.length * 5;
        this.gameState.currentStake = 20;
        this.gameState.activePlayerIndex = 0;
        this.gameState.currentLogs = [`Round ${this.currentRound} Started. Boot collected.`];
        this.gameState.phase = 'ACTIVE';
        this.gameState.sideShowRequest = null;

        // Emit update
        const state = this.getPublicState();
        console.log('[DEBUG] Emitting state_change with phase:', state.phase, 'gamePlayers:', state.gamePlayers.length);
        this.emit('state_change', state);
        return { success: true };
    }

    // --- ACTIONS ---
    handleAction(action) {
        // action: { type, playerId, ...payload }
        
        // F1 FIX: Allow cancel actions even if not the active player's turn
        if (action.type === 'CANCEL_SIDE_SHOW') {
            return this.cancelSideShow();
        }
        if (action.type === 'CANCEL_SHOW') {
            return this.cancelShow();
        }
        
        if (this.gameState.phase !== 'ACTIVE') return { success: false, error: "Game not active" };

        const activePlayer = this.gameState.gamePlayers[this.gameState.activePlayerIndex];
        if (!activePlayer || activePlayer.id !== action.playerId) {
            return { success: false, error: "Not your turn" };
        }

        switch (action.type) {
            case 'SEEN':
                return this.actSeen(activePlayer);
            case 'FOLD':
                return this.actFold(activePlayer);
            case 'BET':
                return this.actBet(activePlayer, action.amount, action.isDouble);
            case 'SIDE_SHOW_REQUEST':
                return this.actSideShowRequest(activePlayer, action.targetId);
            case 'SIDE_SHOW_RESOLVE':
                // Operator resolves who won the side show
                return this.resolveSideShow(action.winnerId);
            case 'SHOW':
                return this.requestShow(activePlayer, action.targetId);
            case 'SHOW_RESOLVE':
                // Operator resolves who won the show
                return this.resolveShow(action.winnerId);
            default:
                return { success: false, error: "Invalid action" };
        }
    }

    // -- ACTION HANDLERS --
    actSeen(player) {
        player.status = 'SEEN';
        this.gameState.currentLogs.push(`${player.name} saw their cards.`);
        this.emit('state_change', this.getPublicState());
        return { success: true };
    }

    actFold(player, isSideShowLoss = false) {
        player.folded = true;
        this.gameState.currentLogs.push(`${player.name} packed.`);

        const remaining = this.gameState.gamePlayers.filter(p => !p.folded);
        if (remaining.length === 1) {
            this.endHand(remaining[0]);
        } else {
            if (!isSideShowLoss) this.rotateTurn();
            this.emit('state_change', this.getPublicState());
        }
        return { success: true };
    }

    actBet(player, amountOverride, isDouble) {
        let newStake = this.gameState.currentStake;
        if (amountOverride) newStake = amountOverride;
        if (isDouble) newStake = this.gameState.currentStake * 2;

        const cost = (player.status === 'BLIND') ? newStake / 2 : newStake;

        player.invested += cost;
        this.gameState.pot += cost;
        this.gameState.currentStake = newStake;

        this.gameState.currentLogs.push(`${player.name} bets ${cost} (Chaal: ${newStake})`);

        this.rotateTurn();
        this.emit('state_change', this.getPublicState());
        return { success: true };
    }

    actSideShowRequest(player, targetId) {
        // Validation: Must be SEEN
        if (player.status !== 'SEEN') return { success: false, error: "Must be SEEN for Side Show" };

        // Find the target player by ID
        const target = this.gameState.gamePlayers.find(p => p.id === targetId);
        
        if (!target) return { success: false, error: "Target player not found" };
        if (target.folded) return { success: false, error: "Cannot Side Show with folded player" };
        if (target.status === 'BLIND') return { success: false, error: "Cannot Side Show with Blind player" };
        if (target.id === player.id) return { success: false, error: "Cannot request Side Show with yourself" };

        // First, charge the player the current stake (like a normal chaal)
        const cost = this.gameState.currentStake; // SEEN player pays full stake
        player.invested += cost;
        this.gameState.pot += cost;
        
        this.gameState.currentLogs.push(`${player.name} bets ${cost} and requested Side Show with ${target.name}`);

        // Create side show request for operator to resolve
        this.gameState.sideShowRequest = { 
            requester: player, 
            target: target,
            timestamp: Date.now()
        };
        
        // F1 FIX: Set timeout for side show request
        this.setRequestTimeout('sideShow', () => {
            this.gameState.currentLogs.push(`Side Show request timed out after ${this.REQUEST_TIMEOUT_MS / 1000}s`);
            this.cancelSideShow();
        });
        
        this.emit('state_change', this.getPublicState());
        return { success: true };
    }
    
    // F1 FIX: Cancel side show request
    cancelSideShow() {
        if (!this.gameState.sideShowRequest) return { success: false, error: "No side show request to cancel" };
        
        const { requester } = this.gameState.sideShowRequest;
        
        // Clear timeout
        if (this.requestTimeouts.has('sideShow')) {
            clearTimeout(this.requestTimeouts.get('sideShow'));
            this.requestTimeouts.delete('sideShow');
        }
        
        this.gameState.sideShowRequest = null;
        this.gameState.currentLogs.push(`${requester.name}'s Side Show request was cancelled`);
        
        this.emit('state_change', this.getPublicState());
        return { success: true };
    }

    resolveSideShow(winnerId) {
        if (!this.gameState.sideShowRequest) return { success: false, error: "No side show request" };
        
        // F1 FIX: Clear the timeout when resolved
        if (this.requestTimeouts.has('sideShow')) {
            clearTimeout(this.requestTimeouts.get('sideShow'));
            this.requestTimeouts.delete('sideShow');
        }
        
        const { requester, target } = this.gameState.sideShowRequest;
        
        // Determine winner and loser
        const winner = winnerId === requester.id ? requester : target;
        const loser = winnerId === requester.id ? target : requester;
        
        this.gameState.currentLogs.push(`Side Show: ${winner.name} wins against ${loser.name}`);
        
        // Note: The current stake remains unchanged after side show
        // The stake does NOT become the target's invested amount
        
        // Find the requester's index before folding
        const requesterIndex = this.gameState.gamePlayers.findIndex(p => p.id === requester.id);
        
        // Fold the loser
        loser.folded = true;
        this.gameState.currentLogs.push(`${loser.name} packed.`);
        
        // Check if only one player remains
        const remaining = this.gameState.gamePlayers.filter(p => !p.folded);
        if (remaining.length === 1) {
            this.gameState.sideShowRequest = null;
            this.endHand(remaining[0]);
            return { success: true };
        }
        
        // Clear the request
        this.gameState.sideShowRequest = null;
        
        // Turn passes to the next player after the requester (not the loser)
        this.gameState.activePlayerIndex = this.getNextActiveIndex(requesterIndex);
        
        this.emit('state_change', this.getPublicState());
        return { success: true };
    }

    requestShow(player, targetId) {
        const remaining = this.gameState.gamePlayers.filter(p => !p.folded);
        
        // Find the target player
        const target = targetId ? 
            remaining.find(p => p.id === targetId) : 
            remaining.find(p => p.id !== player.id);
        
        if (!target) return { success: false, error: "Target player not found" };
        
        // Check if this is a Force Show scenario (seen vs blind)
        const isForceShow = player.status === 'SEEN' && target.status === 'BLIND';
        const blindPlayers = remaining.filter(p => p.status === 'BLIND');
        
        // Force show is only allowed when 1 or 2 blind players remain
        if (isForceShow && blindPlayers.length > 2) {
            return { success: false, error: "Force Show only allowed when 1 or 2 blind players remain" };
        }
        
        // For regular show, need exactly 2 players
        if (!isForceShow && remaining.length !== 2) {
            return { success: false, error: "Can only Show when 2 players remain" };
        }

        // Create show request for operator to resolve
        this.gameState.showRequest = { 
            requester: player, 
            target: target,
            isForceShow: isForceShow,
            timestamp: Date.now()
        };
        
        if (isForceShow) {
            this.gameState.currentLogs.push(`${player.name} requested Force Show against ${target.name} (BLIND)`);
        } else {
            this.gameState.currentLogs.push(`${player.name} requested Show against ${target.name}`);
        }
        
        // F1 FIX: Set timeout for show request
        this.setRequestTimeout('show', () => {
            this.gameState.currentLogs.push(`Show request timed out after ${this.REQUEST_TIMEOUT_MS / 1000}s`);
            this.cancelShow();
        });
        
        this.emit('state_change', this.getPublicState());
        return { success: true };
    }
    
    // F1 FIX: Cancel show request
    cancelShow() {
        if (!this.gameState.showRequest) return { success: false, error: "No show request to cancel" };
        
        const { requester, isForceShow } = this.gameState.showRequest;
        
        // Clear timeout
        if (this.requestTimeouts.has('show')) {
            clearTimeout(this.requestTimeouts.get('show'));
            this.requestTimeouts.delete('show');
        }
        
        this.gameState.showRequest = null;
        this.gameState.currentLogs.push(`${requester.name}'s ${isForceShow ? 'Force Show' : 'Show'} request was cancelled`);
        
        this.emit('state_change', this.getPublicState());
        return { success: true };
    }

    resolveShow(winnerId) {
        if (!this.gameState.showRequest) return { success: false, error: "No show request" };
        
        // F1 FIX: Clear the timeout when resolved
        if (this.requestTimeouts.has('show')) {
            clearTimeout(this.requestTimeouts.get('show'));
            this.requestTimeouts.delete('show');
        }
        
        const { requester, target, isForceShow } = this.gameState.showRequest;
        
        // Determine winner and loser
        const winner = winnerId === requester.id ? requester : target;
        const loser = winnerId === requester.id ? target : requester;
        
        if (isForceShow) {
            // Handle Force Show special rules
            if (winner.id === requester.id) {
                // Seen player wins - stays on current stake
                this.gameState.currentLogs.push(`${requester.name} (SEEN) wins Force Show against ${target.name} (BLIND)`);
                target.folded = true;
                this.gameState.currentLogs.push(`${target.name} packed.`);
            } else {
                // Blind player wins - seen player pays 2x current stake and folds
                const penalty = this.gameState.currentStake * 2;
                requester.invested += penalty;
                this.gameState.pot += penalty;
                requester.folded = true;
                this.gameState.currentLogs.push(`${target.name} (BLIND) wins Force Show against ${requester.name} (SEEN)`);
                this.gameState.currentLogs.push(`${requester.name} pays penalty of ${penalty} and packs.`);
            }
            
            // Clear the request
            this.gameState.showRequest = null;
            
            // Find requester index before checking remaining
            const requesterIndex = this.gameState.gamePlayers.findIndex(p => p.id === requester.id);
            
            // Check if only one player remains
            const remaining = this.gameState.gamePlayers.filter(p => !p.folded);
            if (remaining.length === 1) {
                this.endHand(remaining[0]);
            } else {
                // Turn passes to next player after requester
                this.gameState.activePlayerIndex = this.getNextActiveIndex(requesterIndex);
                this.emit('state_change', this.getPublicState());
            }
        } else {
            // Regular show - end the hand
            this.gameState.currentLogs.push(`${requester.name} showed cards against ${target.name}`);
            
            // Clear the request
            this.gameState.showRequest = null;
            
            this.endHand(winner);
        }
        
        return { success: true };
    }

    // --- HELPERS ---
    rotateTurn() {
        // E2 FIX: Check if only one player remains before rotating
        const remaining = this.gameState.gamePlayers.filter(p => !p.folded);
        if (remaining.length === 1) {
            this.endHand(remaining[0]);
            return;
        }
        
        this.gameState.activePlayerIndex = this.getNextActiveIndex(this.gameState.activePlayerIndex);
    }

    getNextActiveIndex(currentIndex) {
        // E2 FIX: Handle edge case where no players or all folded
        const activePlayers = this.gameState.gamePlayers.filter(p => !p.folded);
        if (activePlayers.length === 0) return currentIndex;
        if (activePlayers.length === 1) {
            return this.gameState.gamePlayers.findIndex(p => p.id === activePlayers[0].id);
        }
        
        let next = (currentIndex + 1) % this.gameState.gamePlayers.length;
        let p = this.gameState.gamePlayers[next];
        let attempts = 0;
        // E2 FIX: Prevent infinite loop with max attempts
        while (p.folded && attempts < this.gameState.gamePlayers.length) {
            next = (next + 1) % this.gameState.gamePlayers.length;
            p = this.gameState.gamePlayers[next];
            attempts++;
        }
        return next;
    }

    getPreviousActiveIndex(currentIndex) {
        // E2 FIX: Handle edge case where no players or all folded
        const activePlayers = this.gameState.gamePlayers.filter(p => !p.folded);
        if (activePlayers.length === 0) return currentIndex;
        if (activePlayers.length === 1) {
            return this.gameState.gamePlayers.findIndex(p => p.id === activePlayers[0].id);
        }
        
        let prev = (currentIndex - 1 + this.gameState.gamePlayers.length) % this.gameState.gamePlayers.length;
        let p = this.gameState.gamePlayers[prev];
        let attempts = 0;
        // E2 FIX: Prevent infinite loop with max attempts
        while (p.folded && attempts < this.gameState.gamePlayers.length) {
            prev = (prev - 1 + this.gameState.gamePlayers.length) % this.gameState.gamePlayers.length;
            p = this.gameState.gamePlayers[prev];
            attempts++;
        }
        return prev;
    }

    endHand(winner) {
        this.gameState.phase = 'SHOWDOWN';
        this.gameState.currentLogs.push(`Hand Over. Winner: ${winner.name}`);

        // Calculate winnings (basic)
        const netChanges = {};
        this.gameState.players.forEach(p => {
            const played = this.gameState.gamePlayers.find(gp => gp.id === p.id);
            if (!played) {
                netChanges[p.id] = 0;
            } else {
                if (p.id === winner.id) {
                    netChanges[p.id] = this.gameState.pot - played.invested;
                    p.sessionBalance += netChanges[p.id];
                } else {
                    netChanges[p.id] = -played.invested;
                    p.sessionBalance += netChanges[p.id];
                }
            }
        });

        // Increment round counter here (when hand actually ends)
        this.currentRound++;
        
        // Check if session is complete
        const isSessionOver = this.currentRound > this.totalRounds;

        // Emit state change first so clients see SHOWDOWN phase
        this.emit('state_change', this.getPublicState());
        
        // Then emit hand complete for the summary
        this.emit('hand_complete', {
            winner,
            pot: this.gameState.pot,
            netChanges,
            currentRound: this.currentRound,
            isSessionOver
        });
        
        // If session is over, emit session_ended event
        if (isSessionOver) {
            this.isActive = false;
            this.emit('session_ended', { 
                reason: 'MAX_ROUNDS_REACHED',
                finalRound: this.currentRound - 1,
                totalRounds: this.totalRounds
            });
        }
    }

    getPublicState() {
        // Don't expose hands to clients (remove hand property from gamePlayers)
        const publicGamePlayers = this.gameState.gamePlayers.map(p => {
            const { hand, ...publicPlayer } = p;
            return publicPlayer;
        });

        return {
            players: this.gameState.players,
            gamePlayers: publicGamePlayers,
            pot: this.gameState.pot,
            currentStake: this.gameState.currentStake,
            activePlayerIndex: this.gameState.activePlayerIndex,
            currentLogs: this.gameState.currentLogs,
            phase: this.gameState.phase,
            sideShowRequest: this.gameState.sideShowRequest,
            showRequest: this.gameState.showRequest,
            currentRound: this.currentRound,
            totalRounds: this.totalRounds
        };
    }
}

module.exports = GameManager;
