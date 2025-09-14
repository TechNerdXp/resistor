(function() {
  console.log('Challenge script loaded');
  if (window.__challengeInjected) {
    console.log('Already injected, skipping');
    return;
  }
  window.__challengeInjected = true;
  console.log('Proceeding with challenge');

  const quotes = [
    "Productivity is never an accident. It is always the result of a commitment to excellence, intelligent planning, and focused effort. – Paul J. Meyer",
    "The way to get started is to quit talking and begin doing. – Walt Disney",
    "Don't watch the clock; do what it does. Keep going. – Sam Levenson",
    "You miss 100% of the shots you don't take. – Wayne Gretzky",
    "The only way to do great work is to love what you do. – Steve Jobs",
    "Believe you can and you're halfway there. – Theodore Roosevelt",
    "The future depends on what you do today. – Mahatma Gandhi",
    "Success is not final, failure is not fatal: It is the courage to continue that counts. – Winston Churchill",
    "Your time is limited, so don't waste it living someone else's life. – Steve Jobs",
    "The best way to predict the future is to create it. – Peter Drucker"
  ];

  chrome.storage.sync.get(["difficulty", "redirectUrl"], (data) => {
    let difficulty = data.difficulty || 'easy';
    if (difficulty === 'easy') difficulty = 1;
    else if (difficulty === 'medium') difficulty = 2;
    else difficulty = 3;
    const redirectUrl = data.redirectUrl || 'https://www.upwork.com';
    const overlay = document.createElement('div');
    overlay.id = 'challenge-overlay';
    Object.assign(overlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      background: 'linear-gradient(135deg, #232526 0%, #414345 100%)',
      color: 'white',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: '10000',
      fontFamily: 'Segoe UI, Arial, Helvetica, sans-serif',
      textAlign: 'center',
      padding: '0',
      margin: '0'
    });

    const quoteDiv = document.createElement('div');
    quoteDiv.textContent = quotes[Math.floor(Math.random() * quotes.length)];
    Object.assign(quoteDiv.style, {
      fontStyle: 'italic',
      marginBottom: '32px',
      maxWidth: '80vw',
      width: '80vw',
      fontSize: '2em',
      fontFamily: 'Georgia, serif',
      background: 'rgba(30,30,30,0.7)',
      borderRadius: '18px',
      padding: '32px',
      boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '120px'
    });

    const h1 = document.createElement('h1');
    h1.textContent = 'Resist Distractions';
    Object.assign(h1.style, {
      fontSize: '2.2em',
      fontWeight: '700',
      margin: '24px 0 12px 0',
      letterSpacing: '1px'
    });

    const iconImg = document.createElement('img');
    iconImg.src = chrome.runtime.getURL('icons/icon128.png');
    iconImg.alt = 'Resistor Icon';
    Object.assign(iconImg.style, {
      width: '64px',
      height: '64px',
      marginBottom: '20px'
    });

    const p = document.createElement('p');
    let challengeText = '';
    let placeholder = '';
    // Challenge sets for each difficulty
    const basicChallenges = [
      {text: 'Type "breakthrough" to continue:', answer: 'breakthrough'},
      {text: 'Type "overcome" to continue:', answer: 'overcome'},
      {text: 'Type "persist" to continue:', answer: 'persist'},
      {text: 'Type "advance" to continue:', answer: 'advance'},
      {text: 'Type "move forward" to continue:', answer: 'move forward'},
      {text: 'Type "progress" to continue:', answer: 'progress'},
      {text: 'Type "conquer" to continue:', answer: 'conquer'},
      {text: 'Type "rise above" to continue:', answer: 'rise above'},
      {text: 'Type "push through" to continue:', answer: 'push through'},
      {text: 'Type "excel" to continue:', answer: 'excel'}
    ];
    const mediumChallenges = [
      {text: 'Solve: 15 + 27 = ?', answer: '42'},
      {text: 'Solve: 8 x 7 = ?', answer: '56'},
      {text: 'Solve: 100 / 4 = ?', answer: '25'},
      {text: 'Solve: 9 x 6 = ?', answer: '54'},
      {text: 'Solve: 12 + 23 = ?', answer: '35'},
      {text: 'Solve: 7 x 5 = ?', answer: '35'},
      {text: 'Solve: 81 / 9 = ?', answer: '9'},
      {text: 'Solve: 14 + 19 = ?', answer: '33'},
      {text: 'Solve: 6 x 8 = ?', answer: '48'},
      {text: 'Solve: 50 - 17 = ?', answer: '33'}
    ];
    const hardChallenges = [
      {text: 'Type: "I choose to be productive today."', answer: 'I choose to be productive today.'},
      {text: 'Type: "Focus brings results."', answer: 'Focus brings results.'},
      {text: 'Type: "Discipline creates freedom."', answer: 'Discipline creates freedom.'},
      {text: 'Type: "I am stronger than distraction."', answer: 'I am stronger than distraction.'},
      {text: 'Type: "My goals matter more."', answer: 'My goals matter more.'},
      {text: 'Type: "I am in control of my actions."', answer: 'I am in control of my actions.'},
      {text: 'Type: "I break through resistance."', answer: 'I break through resistance.'},
      {text: 'Type: "I am focused and determined."', answer: 'I am focused and determined.'},
      {text: 'Type: "I choose progress over comfort."', answer: 'I choose progress over comfort.'},
      {text: 'Type: "I am committed to my success."', answer: 'I am committed to my success.'}
    ];
    let challengeObj;
    if (difficulty === 1) {
      challengeObj = basicChallenges[Math.floor(Math.random() * basicChallenges.length)];
      challengeText = challengeObj.text;
      placeholder = 'Enter the word';
    } else if (difficulty === 2) {
      challengeObj = mediumChallenges[Math.floor(Math.random() * mediumChallenges.length)];
      challengeText = challengeObj.text;
      placeholder = 'Enter your answer';
    } else {
      challengeObj = hardChallenges[Math.floor(Math.random() * hardChallenges.length)];
      challengeText = challengeObj.text;
      placeholder = 'Enter the phrase';
    }
    Object.assign(p.style, {
      fontSize: '1.3em',
      margin: '18px 0 10px 0',
      fontWeight: '500',
      letterSpacing: '0.5px',
      minHeight: '32px'
    });
    p.textContent = challengeText;

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = placeholder;
    Object.assign(input.style, {
      padding: '14px 18px',
      fontSize: '1.2em',
      margin: '12px 0',
      borderRadius: '8px',
      border: 'none',
      outline: 'none',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      textAlign: 'center',
      width: '320px',
      maxWidth: '80vw',
      background: 'rgba(255,255,255,0.15)',
      color: '#fff',
      fontWeight: '500',
      letterSpacing: '0.5px'
    });

    const buttonContainer = document.createElement('div');
    Object.assign(buttonContainer.style, {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '20px',
      marginTop: '18px',
      maxWidth: '80vw',
      width: '356px'
    });

    const button = document.createElement('button');
    button.textContent = 'Submit';
    Object.assign(button.style, {
      padding: '14px 18px',
      fontSize: '1.2em',
      borderRadius: '8px',
      border: 'none',
      background: 'linear-gradient(90deg, #00c6ff 0%, #0072ff 100%)',
      color: '#fff',
      fontWeight: '600',
      margin: '0',
      boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
      cursor: 'pointer',
      transition: 'background 0.2s',
      flex: '1',
      whiteSpace: 'nowrap'
    });
    button.onmouseover = () => {
      button.style.background = 'linear-gradient(90deg, #0072ff 0%, #00c6ff 100%)';
    };
    button.onmouseout = () => {
      button.style.background = 'linear-gradient(90deg, #00c6ff 0%, #0072ff 100%)';
    };

    const giveUpButton = document.createElement('button');
    giveUpButton.textContent = 'Refocus Your Energy';
    Object.assign(giveUpButton.style, {
      padding: '14px 18px',
      fontSize: '1.2em',
      borderRadius: '8px',
      border: 'none',
      background: 'linear-gradient(90deg, #ff6b6b 0%, #ee5a52 100%)',
      color: '#fff',
      fontWeight: '600',
      margin: '0',
      boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
      cursor: 'pointer',
      transition: 'background 0.2s',
      flex: '1',
      whiteSpace: 'nowrap'
    });
    giveUpButton.onmouseover = () => {
      giveUpButton.style.background = 'linear-gradient(90deg, #ee5a52 0%, #ff6b6b 100%)';
    };
    giveUpButton.onmouseout = () => {
      giveUpButton.style.background = 'linear-gradient(90deg, #ff6b6b 0%, #ee5a52 100%)';
    };
    giveUpButton.onclick = () => {
      window.location.href = redirectUrl;
    };

    const errorDiv = document.createElement('div');
    Object.assign(errorDiv.style, {
      color: '#ff4d4f',
      marginTop: '14px',
      fontSize: '1.1em',
      fontWeight: '600',
      minHeight: '28px'
    });

    buttonContainer.appendChild(button);
    buttonContainer.appendChild(giveUpButton);

    overlay.appendChild(quoteDiv);
    overlay.appendChild(iconImg);
    overlay.appendChild(h1);
    overlay.appendChild(p);
    overlay.appendChild(input);
    overlay.appendChild(buttonContainer);
    const devLink = document.createElement('a');
    devLink.href = 'https://x.com/technerdxp';
    devLink.textContent = '@TechNerdXp';
    devLink.target = '_blank';
    Object.assign(devLink.style, {
      position: 'absolute',
      bottom: '10px',
      right: '10px',
      fontSize: '0.8em',
      color: 'rgba(255,255,255,0.6)',
      textDecoration: 'none',
      fontWeight: '400'
    });
    devLink.onmouseover = () => devLink.style.color = 'rgba(255,255,255,0.9)';
    devLink.onmouseout = () => devLink.style.color = 'rgba(255,255,255,0.6)';

    overlay.appendChild(devLink);

    overlay.appendChild(errorDiv);

    document.body.appendChild(overlay);
    console.log('Overlay appended to body');

    button.addEventListener('click', () => {
      const val = input.value.trim();
      let correct = false;
      if (challengeObj) {
        if (difficulty === 1 && val.toLowerCase() === challengeObj.answer.toLowerCase()) correct = true;
        else if (difficulty === 2 && val === challengeObj.answer) correct = true;
        else if (difficulty === 3 && val === challengeObj.answer) correct = true;
      }
      if (correct) {
        overlay.remove();
      } else {
        errorDiv.textContent = 'Incorrect! Try again.';
      }
    });
  });
})();