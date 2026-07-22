export const bookTags = [
  { value: "changed-my-life", label: "changed my life" },
  { value: "startups", label: "startups / entrepreneurial" },
  { value: "self-help", label: "self-help" },
  { value: "economics", label: "economics" },
  { value: "psychology", label: "psychology" },
  { value: "faith", label: "faith" },
  { value: "engineering", label: "engineering" },
  { value: "child-development", label: "child development" },
  // { value: "skip", label: "not my favorite" },
] as const;

export type BookTag = (typeof bookTags)[number]["value"];

type Book = {
  title: string;
  author: string;
  cover?: string;
  tags: BookTag[];
  note: string | { text: string; strike?: boolean }[];
};

export const books: Book[] = [
  {
    title: "Zero to One",
    author: "Peter Thiel with Blake Masters",
    cover: "https://covers.openlibrary.org/b/isbn/9780804139298-L.jpg",
    tags: ["changed-my-life", "startups"],
    note: [
      { text: "A contrarian approach to " },
      { text: "startups", strike: true },
      {
        text: " life. The greatest book I've ever read.",
      },
    ],
  },
  {
    title: "Living Fearless",
    author: "Jamie Winship",
    cover: "https://covers.openlibrary.org/b/isbn/9780800740290-L.jpg",
    tags: ["changed-my-life", "faith"],
    note: "Fear isn't the reason you don't take risks. You don't take them because you lack identity.",
  },
  {
    title: "Never Split the Difference",
    author: "Chris Voss with Tahl Raz",
    cover: "https://covers.openlibrary.org/b/isbn/9780062407801-L.jpg",
    tags: ["changed-my-life", "startups"],
    note: "Humans don't make logical decisions. Tap into their emotions, and you'll get anything you want. Working people is a science.",
  },
  {
    title: "Thinking, Fast and Slow",
    author: "Daniel Kahneman",
    cover: "/books/thinking-fast-and-slow.jpg",
    tags: ["changed-my-life", "psychology"],
    note: `It doesn't matter how complex or inconsequential your thinking may be; your intuition is naturally vulnerable to systematic errors, and you must learn to reject those errors.`,
  },
  {
    title: "Hope and Help for Your Nerves",
    author: "Claire Weekes",
    cover: "https://covers.openlibrary.org/b/id/13305028-L.jpg",
    tags: ["changed-my-life", "psychology"],
    note: "Pioneer in cognitive behavioral therapy. Most modern anxiety recovery programs and therapy revolve around her work.",
  },
  {
    title: "Code",
    author: "Charles Petzold",
    cover: "https://covers.openlibrary.org/b/isbn/9780137909100-L.jpg",
    tags: ["engineering"],
    note: "An amazing intro to the big three: computer science, computer engineering, and electrical engineering. Although unbalanced towards hardware engineering.",
  },
  {
    title: "Operating System Concepts",
    author: "Abraham Silberschatz, Peter B. Galvin, and Greg Gagne",
    cover: "https://covers.openlibrary.org/b/isbn/9781119456339-L.jpg",
    tags: ["engineering"],
    note: `A little dry compared to OSTEP. But regardless still a beautiful intro to operating systems by "uncle Avi"`,
  },
  {
    title: "Operating Systems: Three Easy Pieces",
    author: "Remzi H. Arpaci-Dusseau and Andrea C. Arpaci-Dusseau",
    cover: "https://covers.openlibrary.org/b/isbn/9781985086593-L.jpg",
    tags: ["engineering"],
    note: `An eloquent and elegant introduction to operating systems. Currently replacing its predecessor, OS Concepts.`,
  },
  {
    title: "An Introduction to GCC",
    author: "Brian Gough",
    cover: "https://covers.openlibrary.org/b/isbn/9780954161798-L.jpg",
    tags: ["engineering"],
    note: "Mostly read it since I was tinkering with C at the time and needed better compiler settings.",
  },
  {
    title: "Grokking Algorithms",
    author: "Aditya Y. Bhargava",
    cover: "https://covers.openlibrary.org/b/isbn/9781617292231-L.jpg",
    tags: ["engineering"],
    note: "Simple. Great for DSA interviews.",
  },
  {
    title: "Web Scalability for Startup Engineers",
    author: "Artur Ejsmont",
    cover: "https://covers.openlibrary.org/b/isbn/9780071843652-L.jpg",
    tags: ["engineering"],
    note: "Slightly obsolete. Contains great principles but a great portion of it is currently not relevant.",
  },
  {
    title: "Economics in One Lesson",
    author: "Henry Hazlitt",
    cover: "https://covers.openlibrary.org/b/id/4437768-L.jpg",
    tags: ["economics"],
    note: "A libertarian's point of view on economics. A good read if you think AI labor displacement will negatively impact the economy.",
  },
  {
    title: "The Millionaire Next Door",
    author: "Thomas J. Stanley and William D. Danko",
    cover: "https://covers.openlibrary.org/b/isbn/9780671015206-L.jpg",
    tags: ["startups"],
    note: `Piggybacks off of a dissertation published in the 90s. Unbiased and still relevant. The "boring" way to get wealthy.`,
  },
  {
    title: "Blue Ocean Strategy",
    author: "W. Chan Kim and Renee Mauborgne",
    cover: "https://covers.openlibrary.org/b/id/8219313-L.jpg",
    tags: ["startups"],
    note: "Many tie this book to 'Zero To One'. But Zero to one has a deeper meaning and is broad. This is more specific on how to create blue ocean markets in a red sea of competiion.",
  },
  {
    title: "Founding Sales",
    author: "Pete Kazanjy",
    tags: ["startups"],
    note: "A must-read on founder led sales. Covers it all: mindset, prospecting, cold calling, demos, closing, scaling, and more. ",
  },
  {
    title: "The Mom Test",
    author: "Rob Fitzpatrick",
    cover: "https://covers.openlibrary.org/b/isbn/9781492180746-L.jpg",
    tags: ["startups"],
    note: "Sales isn't word slop. It's about asking the right questions.",
  },
  {
    title: "The Whole-Brain Child",
    author: "Daniel J. Siegel and Tina Payne Bryson",
    cover: "https://covers.openlibrary.org/b/isbn/9780553386691-L.jpg",
    tags: ["child-development"],
    note: `A simple child development and parenting book. Could be "revolutionary" for emotionally unavailable parents.`,
  },
  {
    title: "The Montessori Baby",
    author: "Simone Davies and Junnifa Uzodike",
    cover: "https://covers.openlibrary.org/b/id/11273152-L.jpg",
    tags: ["child-development"],
    note: "The most pretenious book I've read in my life.",
  },

  {
    title: "DARE",
    author: "Barry McDonagh",
    cover: "https://covers.openlibrary.org/b/id/14851341-L.jpg",
    tags: ["psychology"],
    note: `Builds on Claire Weeks "Hope and Help for Your Nerves". Still a good read if you have crippling anxiety.`,
  },
  {
    title: "The Greatest Salesman in the World",
    author: "Og Mandino",
    cover: "https://covers.openlibrary.org/b/isbn/9780553277579-L.jpg",
    tags: ["self-help"],
    note: "General self-help book. Mostly read it since Jose Menenedez recommended it to his children right before they killed him.",
  },
  {
    title: "The Millionaire Fastlane",
    author: "M. J. DeMarco",
    cover: "https://covers.openlibrary.org/b/id/7892520-L.jpg",
    tags: ["self-help"],
    note: "Unecessarily long and pretentious.",
  },
  {
    title: "The Simple Path to Wealth",
    author: "J. L. Collins",
    cover: "https://covers.openlibrary.org/b/id/10448941-L.jpg",
    tags: ["self-help"],
    note: "Too simple for my liking, but great if you want to retire a millionare at 65.",
  },
  {
    title: "Call Me Crazy, but I'm Hearing God's Voice",
    author: "Kim Clement",
    cover: "https://covers.openlibrary.org/b/id/1454849-L.jpg",
    tags: ["faith"],
    note: "A little esoteric, but call me crazy because I'm hearing God's voice.",
  },
  {
    title: "Secrets of the Prophetic",
    author: "Kim Clement",
    cover: "https://covers.openlibrary.org/b/id/529002-L.jpg",
    tags: ["faith"],
    note: "Not in everyone's wheel house.",
  },
];
