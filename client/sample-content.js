/**
 * Sample document content for demo purposes.
 * Each entry is a "page" rendered in the viewer.
 */
export const sampleDocument = {
  title: "Introduction to Spaced Repetition",
  pages: [
    {
      heading: "Introduction to Spaced Repetition",
      paragraphs: [
        "Spaced repetition is a learning technique that incorporates increasing intervals of time between subsequent review of previously learned material. It exploits the psychological spacing effect, which demonstrates that learning is more effective when study sessions are spaced out over time rather than concentrated in a single session.",
        "The concept was first systematically studied by Hermann Ebbinghaus in 1885. His experiments on memory led to the discovery of the forgetting curve — a mathematical model describing the rate at which information is forgotten over time. Ebbinghaus found that memory retention decays exponentially, but that each review resets and flattens the curve.",
        "Modern spaced repetition systems (SRS) use algorithms to calculate the optimal time to review each piece of information. The goal is to present material just before the learner would forget it, maximizing retention while minimizing the total number of reviews needed.",
        "The most well-known SRS algorithm is SM-2, developed by Piotr Wozniak in 1987 for the SuperMemo software. SM-2 adjusts the interval between reviews based on how easily the learner recalls the information, using a simple quality rating scale from 0 to 5.",
      ],
    },
    {
      heading: "The Spacing Effect",
      paragraphs: [
        "The spacing effect refers to the finding that information is better retained when study sessions are spaced apart rather than massed together. This phenomenon has been replicated across hundreds of studies spanning over a century of research.",
        "When you cram information in a single session, you may feel confident immediately afterward, but retention drops sharply within days. In contrast, spreading the same total study time across multiple sessions — with gaps between them — produces dramatically better long-term retention.",
        "Researchers believe the spacing effect works because each retrieval attempt strengthens the memory trace in a different way. The effort required to recall information after a delay signals to the brain that this information is important and worth consolidating into long-term storage.",
        "Desirable difficulty is a related concept: making retrieval slightly harder (by waiting longer between reviews) actually improves learning outcomes. This counterintuitive finding is central to why spaced repetition works — the struggle to remember is itself the mechanism that strengthens memory.",
      ],
    },
    {
      heading: "Modern SRS Algorithms",
      paragraphs: [
        "Free Spaced Repetition Scheduler (FSRS) is a modern algorithm based on the DSR (Difficulty, Stability, Retrievability) model of memory. Unlike SM-2, FSRS uses machine learning to optimize scheduling parameters based on a learner's actual review history.",
        "FSRS models two key properties for each card: stability (how long a memory lasts before dropping below a 90% recall threshold) and difficulty (how inherently hard a card is to learn). These parameters are updated after each review using the learner's rating.",
        "The Leitner system takes a different approach, using physical or virtual boxes numbered 1 through N. New and forgotten cards go into Box 1, which is reviewed most frequently. Each time a card is recalled successfully, it advances to the next box, which is reviewed less often.",
        "Regardless of the algorithm, all spaced repetition systems share a common principle: items you find easy are shown less often, and items you struggle with are shown more often. The algorithm's job is to find the optimal balance between reviewing too early (wasting time) and reviewing too late (forgetting).",
      ],
    },
    {
      heading: "Applications and Best Practices",
      paragraphs: [
        "Spaced repetition is most commonly associated with flashcard applications like Anki, SuperMemo, and Mnemosyne. However, the technique can be applied to any domain where long-term retention is important: language learning, medical education, programming concepts, legal statutes, and more.",
        "Effective flashcards follow the minimum information principle: each card should test exactly one piece of knowledge. Cards that try to cover multiple facts are harder to schedule because the learner may remember some parts but not others.",
        "The 20 rules of formulating knowledge, developed by Piotr Wozniak, provide guidelines for creating effective cards. Key principles include: keep it simple, use cloze deletions for memorizing sentences, avoid sets and enumerations, and always provide context.",
        "The Open Spaced Repetition Protocol (OSRP) aims to decouple content discovery from retention management. Any application where a user encounters information worth remembering — a reader app, a podcast player, a language tool — can push content to any compatible SRS server. This separation of concerns allows specialized tools to focus on what they do best.",
      ],
    },
  ],
};
