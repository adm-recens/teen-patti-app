import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, HelpCircle, Crown, Star, Trophy, Medal, Award, Sparkles } from 'lucide-react';

const TeenPattiHelp = () => {
  const navigate = useNavigate();
  const [selectedRank, setSelectedRank] = useState(null);

  // Teen Patti hand rankings from highest to lowest
  const handRankings = [
    {
      rank: 1,
      name: "Trio (Three of a Kind)",
      description: "Three cards of the same rank",
      example: "A♠ A♥ A♦",
      icon: <Crown className="w-8 h-8 text-yellow-500" />,
      color: "from-yellow-500 to-amber-600",
      probability: "0.24%",
      details: "The highest possible hand. Three Aces is the best trio."
    },
    {
      rank: 2,
      name: "Pure Sequence (Straight Flush)",
      description: "Three consecutive cards of the same suit",
      example: "A♠ K♠ Q♠",
      icon: <Trophy className="w-8 h-8 text-purple-500" />,
      color: "from-purple-500 to-purple-700",
      probability: "0.22%",
      details: "Three cards in sequence, all of the same suit. A-K-Q of spades is the highest."
    },
    {
      rank: 3,
      name: "Sequence (Straight)",
      description: "Three consecutive cards, not of same suit",
      example: "A♠ K♥ Q♦",
      icon: <Medal className="w-8 h-8 text-blue-500" />,
      color: "from-blue-500 to-blue-700",
      probability: "3.26%",
      details: "Three cards in sequence, but mixed suits. A-K-Q is the highest sequence."
    },
    {
      rank: 4,
      name: "Color (Flush)",
      description: "Three cards of the same suit, not in sequence",
      example: "A♠ 10♠ 7♠",
      icon: <Award className="w-8 h-8 text-green-500" />,
      color: "from-green-500 to-green-700",
      probability: "4.96%",
      details: "All three cards of the same suit. Compare highest cards if multiple players have color."
    },
    {
      rank: 5,
      name: "Pair",
      description: "Two cards of the same rank",
      example: "A♠ A♥ K♦",
      icon: <Star className="w-8 h-8 text-orange-500" />,
      color: "from-orange-500 to-orange-700",
      probability: "16.94%",
      details: "Two cards of the same rank. A-A-K beats K-K-Q. If pairs are equal, third card decides."
    },
    {
      rank: 6,
      name: "High Card",
      description: "None of the above combinations",
      example: "A♠ K♥ 10♦",
      icon: <Sparkles className="w-8 h-8 text-slate-400" />,
      color: "from-slate-500 to-slate-700",
      probability: "74.39%",
      details: "When no combination is made. Compare highest cards. A-K-10 beats K-Q-J."
    }
  ];

  const cardSuits = {
    '♠': 'text-slate-400',
    '♥': 'text-red-500',
    '♦': 'text-red-400',
    '♣': 'text-slate-500'
  };

  const renderCards = (example) => {
    const cards = example.split(' ');
    return (
      <div className="flex gap-2 justify-center">
        {cards.map((card, idx) => {
          const suit = card.slice(-1);
          const rank = card.slice(0, -1);
          return (
            <div key={idx} className="w-12 h-16 bg-white rounded-lg shadow-lg flex flex-col items-center justify-center border-2 border-slate-200">
              <span className="text-lg font-bold text-slate-800">{rank}</span>
              <span className={`text-xl ${cardSuits[suit] || 'text-slate-600'}`}>{suit}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => navigate(-1)} 
                className="p-2 hover:bg-white/10 rounded-xl transition-colors"
              >
                <ArrowLeft className="text-white" size={24} />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center">
                  <HelpCircle className="text-white" size={28} />
                </div>
                <div>
                  <h1 className="text-2xl font-black text-white">Teen Patti Guide</h1>
                  <p className="text-sm text-slate-400">Hand Rankings & Rules</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Introduction */}
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-black text-white mb-4">Hand Rankings</h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Teen Patti is played with a standard 52-card deck. Each player gets 3 cards. 
            The player with the highest-ranking hand wins. Here's the complete ranking order from highest to lowest:
          </p>
        </div>

        {/* Rankings Grid */}
        <div className="grid gap-4">
          {handRankings.map((hand) => (
            <div 
              key={hand.rank}
              className={`bg-white/5 rounded-2xl border border-white/10 overflow-hidden transition-all duration-300 ${
                selectedRank === hand.rank ? 'ring-2 ring-purple-500' : ''
              }`}
            >
              <div 
                className="p-6 cursor-pointer"
                onClick={() => setSelectedRank(selectedRank === hand.rank ? null : hand.rank)}
              >
                <div className="flex items-center gap-4">
                  {/* Rank Badge */}
                  <div className={`w-16 h-16 bg-gradient-to-br ${hand.color} rounded-2xl flex items-center justify-center shadow-lg shrink-0`}>
                    {hand.icon}
                  </div>

                  {/* Hand Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-2xl font-black text-white">#{hand.rank}</span>
                      <h3 className="text-xl font-bold text-white">{hand.name}</h3>
                    </div>
                    <p className="text-slate-400">{hand.description}</p>
                  </div>

                  {/* Example Cards */}
                  <div className="hidden md:block">
                    {renderCards(hand.example)}
                  </div>

                  {/* Probability */}
                  <div className="text-right shrink-0">
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Probability</p>
                    <p className="text-lg font-bold text-purple-400">{hand.probability}</p>
                  </div>
                </div>

                {/* Mobile Example */}
                <div className="md:hidden mt-4">
                  {renderCards(hand.example)}
                </div>

                {/* Expanded Details */}
                {selectedRank === hand.rank && (
                  <div className="mt-6 pt-6 border-t border-white/10">
                    <div className="bg-white/5 rounded-xl p-4">
                      <h4 className="font-bold text-white mb-2">Details</h4>
                      <p className="text-slate-300">{hand.details}</p>
                      
                      <div className="mt-4">
                        <h5 className="font-bold text-white mb-2">Example:</h5>
                        <div className="flex items-center gap-4">
                          {renderCards(hand.example)}
                          <span className="text-slate-400">=</span>
                          <span className="text-lg font-bold text-white">{hand.name}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Special Rules Section */}
        <div className="mt-8 grid md:grid-cols-2 gap-6">
          {/* A-2-3 Rule */}
          <div className="bg-gradient-to-br from-amber-900/50 to-orange-900/50 rounded-2xl border border-amber-500/30 p-6">
            <h3 className="text-xl font-black text-white mb-4 flex items-center gap-2">
              <span className="text-2xl">🃏</span> Special A-2-3 Rule
            </h3>
            <div className="space-y-3 text-slate-300">
              <p>A-2-3 is the <strong className="text-amber-400">LOWEST</strong> straight/sequence, not the highest!</p>
              <div className="flex gap-2 justify-center my-4">
                <div className="w-12 h-16 bg-white rounded-lg shadow flex flex-col items-center justify-center border-2 border-slate-200">
                  <span className="text-lg font-bold text-slate-800">A</span>
                  <span className="text-xl text-slate-400">♠</span>
                </div>
                <div className="w-12 h-16 bg-white rounded-lg shadow flex flex-col items-center justify-center border-2 border-slate-200">
                  <span className="text-lg font-bold text-slate-800">2</span>
                  <span className="text-xl text-slate-400">♠</span>
                </div>
                <div className="w-12 h-16 bg-white rounded-lg shadow flex flex-col items-center justify-center border-2 border-slate-200">
                  <span className="text-lg font-bold text-slate-800">3</span>
                  <span className="text-xl text-slate-400">♠</span>
                </div>
              </div>
              <p className="text-sm text-slate-400">
                Ranking: <strong className="text-white">A-K-Q &gt; K-Q-J &gt; ... &gt; 4-3-2 &gt; A-2-3</strong>
              </p>
            </div>
          </div>

          {/* Side Show Rules */}
          <div className="bg-gradient-to-br from-blue-900/50 to-indigo-900/50 rounded-2xl border border-blue-500/30 p-6">
            <h3 className="text-xl font-black text-white mb-4 flex items-center gap-2">
              <span className="text-2xl">👁️</span> Side Show Rules
            </h3>
            <div className="space-y-2 text-slate-300 text-sm">
              <p>• <strong className="text-blue-400">Who can request:</strong> Only SEEN players</p>
              <p>• <strong className="text-blue-400">Target:</strong> Previous active player who is also SEEN</p>
              <p>• <strong className="text-blue-400">Cost:</strong> Equal to current stake</p>
              <p>• <strong className="text-blue-400">Process:</strong> Operator compares hands privately</p>
              <p>• <strong className="text-blue-400">Result:</strong> Loser folds, stake stays the same</p>
              <p>• <strong className="text-red-400">Cannot request:</strong> Against BLIND players</p>
            </div>
          </div>
        </div>

        {/* Force Show & Betting */}
        <div className="mt-6 grid md:grid-cols-2 gap-6">
          {/* Force Show */}
          <div className="bg-gradient-to-br from-red-900/50 to-rose-900/50 rounded-2xl border border-red-500/30 p-6">
            <h3 className="text-xl font-black text-white mb-4 flex items-center gap-2">
              <span className="text-2xl">⚡</span> Force Show Rules
            </h3>
            <div className="space-y-2 text-slate-300 text-sm">
              <p>• <strong className="text-red-400">When:</strong> SEEN player vs BLIND player (1-2 blinds left)</p>
              <p>• <strong className="text-white">If SEEN wins:</strong> Normal win, blind player folds</p>
              <p>• <strong className="text-red-400">If BLIND wins:</strong> SEEN player pays <strong>2× penalty</strong> and folds!</p>
              <div className="mt-3 p-3 bg-red-950/50 rounded-lg border border-red-500/20">
                <p className="text-red-300 text-xs">
                  ⚠️ Risky move! If you challenge a blind player and lose, you pay double and fold.
                </p>
              </div>
            </div>
          </div>

          {/* Betting Structure */}
          <div className="bg-gradient-to-br from-green-900/50 to-emerald-900/50 rounded-2xl border border-green-500/30 p-6">
            <h3 className="text-xl font-black text-white mb-4 flex items-center gap-2">
              <span className="text-2xl">💰</span> Betting Structure
            </h3>
            <div className="space-y-2 text-slate-300 text-sm">
              <p>• <strong className="text-green-400">Boot:</strong> 5 chips (collected from all at start)</p>
              <p>• <strong className="text-green-400">Initial Stake:</strong> 20 chips</p>
              <p>• <strong className="text-white">BLIND bet:</strong> ½ of current stake</p>
              <p>• <strong className="text-white">SEEN bet (Chaal):</strong> Full current stake</p>
              <p>• <strong className="text-green-400">Raise:</strong> Double the current stake</p>
              <p>• <strong className="text-slate-400">Stake stays</strong> after Side Show</p>
            </div>
          </div>
        </div>

        {/* Tie Breaker Rules */}
        <div className="mt-8 bg-gradient-to-br from-purple-900/50 to-pink-900/50 rounded-2xl border border-purple-500/30 p-6">
          <h3 className="text-xl font-black text-white mb-4">Tie Breaker Rules</h3>
          <div className="space-y-3 text-slate-300">
            <p>• If two players have the same hand type, compare the highest cards:</p>
            <ul className="ml-6 space-y-1 text-slate-400">
              <li>- <strong className="text-white">Trio:</strong> Higher rank wins (AAA beats KKK)</li>
              <li>- <strong className="text-white">Sequence/Flush:</strong> Highest card wins (A-K-Q beats K-Q-J)</li>
              <li>- <strong className="text-white">Pair:</strong> Higher pair wins, then kicker (A-A-K beats K-K-Q)</li>
              <li>- <strong className="text-white">High Card:</strong> Compare cards in order (A-K-10 beats A-Q-J)</li>
            </ul>
          </div>
        </div>

        {/* Card Rankings */}
        <div className="mt-8 bg-white/5 rounded-2xl border border-white/10 p-6">
          <h3 className="text-xl font-black text-white mb-4">Card Rankings (High to Low)</h3>
          <div className="flex flex-wrap gap-2">
            {['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'].map((card, idx) => (
              <div 
                key={card}
                className="w-12 h-16 bg-white rounded-lg shadow flex flex-col items-center justify-center border-2 border-slate-200"
              >
                <span className="text-lg font-bold text-slate-800">{card}</span>
                <span className="text-xs text-slate-500">#{idx + 1}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-slate-400 text-sm">
            Ace (A) is the highest card, followed by King (K), Queen (Q), Jack (J), and so on down to 2.
          </p>
        </div>

        {/* Quick Tips */}
        <div className="mt-8 grid md:grid-cols-3 gap-4">
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
            <h4 className="font-bold text-green-400 mb-2">Betting Tip</h4>
            <p className="text-slate-400 text-sm">Start with small bets and increase gradually. Watch other players' betting patterns.</p>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
            <h4 className="font-bold text-blue-400 mb-2">Bluffing</h4>
            <p className="text-slate-400 text-sm">Sometimes bet high with weak hands to make others fold. But don't overdo it!</p>
          </div>
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
            <h4 className="font-bold text-purple-400 mb-2">Observation</h4>
            <p className="text-slate-400 text-sm">Pay attention to how others play. Tight players only bet with strong hands.</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TeenPattiHelp;
