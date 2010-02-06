package org.apache.cocoon.spring.web;

import junit.framework.TestCase;

import org.springframework.mock.web.MockServletContext;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.context.ContextLoader;
import org.springframework.web.context.request.RequestContextListener;
import org.springframework.core.io.DefaultResourceLoader;
import org.springframework.core.io.FileSystemResourceLoader;
import org.springframework.core.io.Resource;
import org.w3c.dom.Document;
import org.apache.xerces.parsers.DOMParser;
import org.xml.sax.InputSource;

import javax.servlet.ServletRequestEvent;
import java.io.StringReader;

/**
 * Test cases for {@link CocoonView}
 */
public class CocoonViewTest extends TestCase {

	public void testRender() throws Exception {
		MockServletContext context = new MockServletContext(new FixupResourceLoader());

		context.addInitParameter(ContextLoader.CONFIG_LOCATION_PARAM, "classpath:/applicationContext.xml");
		new ContextLoader().initWebApplicationContext(context);

		CocoonView view = new CocoonView(context, "testview.html");

		MockHttpServletRequest request = new MockHttpServletRequest(context, "GET", "/originalURI.do");
		request.setServletPath("/");
		request.setPathInfo("/testview.html");
		MockHttpServletResponse response = new MockHttpServletResponse();

		ServletRequestEvent event = new ServletRequestEvent(context, request);
		RequestContextListener listener = new RequestContextListener();

		listener.requestInitialized(event);
		view.render(null, request, response);
		listener.requestDestroyed(event);

		assertEquals(200, response.getStatus());
		assertTrue(response.getContentLength() > 0);

		System.out.println("Cocoon response: " + response.getContentAsString());
		DOMParser parser = new DOMParser();
		parser.parse(new InputSource(new StringReader(response.getContentAsString())));
		Document document = parser.getDocument();
		assertEquals("test", document.getDocumentElement().getNodeName());
		assertEquals("Hello World!", document.getDocumentElement().getFirstChild().getNodeValue());
	}

	/**
	 * Override DefaultResourceLoader to remove double-slashes from resource paths,
	 * which Cocoon often requests but DefaultResourceLoader can't handle. 
	 */
	private static final class FixupResourceLoader extends DefaultResourceLoader {
		public Resource getResource(String s) {
			s = s.replaceAll("//", "/");
			return super.getResource(s);
		}
	}

}
