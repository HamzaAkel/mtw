import TitleHeader from "../components/TitleHeader";

const Contact = () => {
  return (
    <section id="contact" className="flex-col-center section-padding">
      <div className="w-full max-w-4xl flex-col-center space-y-10 px-5 md:px-10">
        <TitleHeader
          title="Contact Us"
          sub="Let’s build something great together."
        />

        <div className="card-border rounded-xl p-6 md:p-10 w-full text-white-50 text-center space-y-4">
          <p className="text-lg font-semibold">Reach us at:</p>
          <div className="space-y-2">
            <p>akel.hamza@moderntechworks.com</p>
            <p>duraku.fisnik@moderntechworks.com</p>
            <p>fidan.dilhan@moderntechworks.com</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Contact;
