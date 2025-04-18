const Footer = () => {
  return (
    <footer className="footer bg-dynamic text-dynamic py-10 px-5 md:px-20">
        <div className="flex flex-col justify-center">
          <p className=" text-center md:text-end ">
            © {new Date().getFullYear()} Modern Tech Works. All rights reserved.
          </p>
      </div>
    </footer>
  );
};

export default Footer;
