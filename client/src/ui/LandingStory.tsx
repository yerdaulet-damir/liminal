import "./landing-story.css";

const levels = [
  { marker: "I", name: "The Lobby", detail: "Fluorescent halls that forget where they lead." },
  { marker: "II", name: "The Warehouse", detail: "A blackout, a flashlight, and nowhere to hide." },
  { marker: "III", name: "The Poolrooms", detail: "Blue water under a sky that is not there." },
];

const questions = [
  {
    question: "Is Liminal free, and do I need to install anything?",
    answer: "Liminal runs free in your browser. There is nothing to install and no login required.",
  },
  {
    question: "How many people can play?",
    answer:
      "Liminal is designed for two players. Invite one friend or use Quick Play to meet a random partner.",
  },
  {
    question: "Does Liminal record my microphone?",
    answer:
      "No. Audio is never transmitted. Your device sends only a local loudness byte, and the microphone is always optional.",
  },
];

export function LandingStory() {
  return (
    <>
      <section className="story" id="story" aria-labelledby="story-title">
        <div className="story__lead">
          <h2 id="story-title">Two enter. The rooms listen.</h2>
          <p>
            Keep your friend in sight and search for the keys together. Walls and distance muffle noise.
            A careless step tells the creature where to look.
          </p>
        </div>

        <div className="story__levels" aria-label="Three levels">
          {levels.map((level) => (
            <article className="story__level" key={level.name}>
              <span>{level.marker}</span>
              <div>
                <h3>{level.name}</h3>
                <p>{level.detail}</p>
              </div>
            </article>
          ))}
        </div>

        <aside className="story__link">
          <span>NO LOBBY CODE</span>
          <p>One click creates your room and copies the invitation. Send it. Step through.</p>
        </aside>
      </section>

      <section className="faq" aria-labelledby="faq-title">
        <h2 id="faq-title">Questions from the threshold</h2>
        <div className="faq__grid">
          {questions.map((item) => (
            <article key={item.question}>
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="landing__footer">
        <span>LIMINAL</span>
        <p>WASD to move. Click to look. Escape releases the cursor.</p>
      </footer>
    </>
  );
}
